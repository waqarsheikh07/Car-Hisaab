/* =============================================================================
   calc.js — every rupee figure in the app is computed here.
   Pure functions only: no DOM, no fetch, no globals mutated.
   Runs in the browser (window.Calc) and in Node (module.exports) for tests.
   ============================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Calc = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EXPENSE_CATEGORIES = [
    'repair', 'parts', 'paint', 'transport', 'registration', 'commission', 'other'
  ];

  var STATUSES = ['in_stock', 'under_repair', 'listed', 'sold'];

  var STATUS_LABEL = {
    in_stock: 'In stock',
    under_repair: 'Under repair',
    listed: 'Listed',
    sold: 'Sold'
  };

  /* ---------- primitives -------------------------------------------------- */

  // Treats null/undefined/''/NaN as "unknown", never as 0.
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  // Sum that stays null-safe: unknowns are skipped, not coerced to zero.
  function sum(list, pick) {
    var total = 0;
    (list || []).forEach(function (item) {
      var v = num(pick ? pick(item) : item);
      if (v !== null) total += v;
    });
    return total;
  }

  function parseDate(value) {
    if (!value) return null;
    var d = new Date(String(value) + (String(value).length === 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? null : d;
  }

  function monthKey(value) {
    var d = parseDate(value);
    if (!d) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(key) {
    if (!key) return '—';
    var parts = key.split('-');
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  function daysBetween(from, to) {
    var a = parseDate(from), b = parseDate(to);
    if (!a || !b) return null;
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  /* ---------- formatting -------------------------------------------------- */

  function formatNumber(value) {
    var n = num(value);
    if (n === null) return '—';
    var sign = n < 0 ? '-' : '';
    return sign + Math.abs(Math.round(n)).toLocaleString('en-US');
  }

  function formatPKR(value, opts) {
    var n = num(value);
    if (n === null) return '—';
    var prefix = (opts && opts.noPrefix) ? '' : 'PKR ';
    return prefix + formatNumber(n);
  }

  // Pakistani shorthand: 1 lac = 100,000 · 1 crore = 10,000,000
  function shorthand(value) {
    var n = num(value);
    if (n === null) return '';
    var abs = Math.abs(n);
    if (abs < 100000) return '';
    var sign = n < 0 ? '-' : '';
    function trim(x) { return String(Number(x.toFixed(2))); }
    if (abs >= 10000000) return sign + trim(abs / 10000000) + ' crore';
    return sign + trim(abs / 100000) + ' lac';
  }

  function formatPKRLong(value) {
    var short = shorthand(value);
    return formatPKR(value) + (short ? ' (' + short + ')' : '');
  }

  function formatPercent(value, digits) {
    var n = num(value);
    if (n === null) return '—';
    return (n >= 0 ? '' : '-') + Math.abs(n).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function formatDate(value) {
    var d = parseDate(value);
    if (!d) return '—';
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + names[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ---------- per-car ----------------------------------------------------- */

  function expensesTotal(car) {
    return sum(car && car.expenses, function (e) { return e.amount; });
  }

  function expensesByCategory(car) {
    var out = {};
    EXPENSE_CATEGORIES.forEach(function (c) { out[c] = 0; });
    ((car && car.expenses) || []).forEach(function (e) {
      var cat = EXPENSE_CATEGORIES.indexOf(e.category) === -1 ? 'other' : e.category;
      var amt = num(e.amount);
      if (amt !== null) out[cat] += amt;
    });
    return out;
  }

  // total_cost = purchase_price + every expense on the car.
  // null when the purchase price is still unknown — never a misleading 0.
  function totalCost(car) {
    var purchase = num(car && car.purchase_price);
    if (purchase === null) return null;
    return purchase + expensesTotal(car);
  }

  // profit = sale_price - total_cost.
  // profit_override is the escape hatch for cars where the partner reported only
  // a profit figure. It is used ONLY when the real numbers are missing, so filling
  // in purchase_price + sale_price later silently takes over. Unsold => null.
  function profit(car) {
    if (!car || car.status !== 'sold') return null;
    var cost = totalCost(car);
    var sale = num(car.sale_price);
    if (cost !== null && sale !== null) return sale - cost;
    var override = num(car.profit_override);
    return override === null ? null : override;
  }

  function isProfitEstimated(car) {
    if (!car || car.status !== 'sold') return false;
    var cost = totalCost(car), sale = num(car.sale_price);
    return !(cost !== null && sale !== null) && num(car.profit_override) !== null;
  }

  function splitShares(profitValue, settings) {
    var p = num(profitValue);
    if (p === null) return { mine: null, partner: null };
    var mine = num(settings && settings.profit_split_investor);
    if (mine === null) mine = 50;
    var partner = num(settings && settings.profit_split_partner);
    if (partner === null) partner = 100 - mine;
    return { mine: p * mine / 100, partner: p * partner / 100 };
  }

  function roiPercent(car) {
    var p = profit(car), cost = totalCost(car);
    if (p === null || cost === null || cost === 0) return null;
    return p / cost * 100;
  }

  function daysHeld(car, today) {
    if (!car) return null;
    var end = car.status === 'sold' ? car.sale_date : (today || new Date().toISOString().slice(0, 10));
    return daysBetween(car.purchase_date, end);
  }

  // One object with every derived figure a view needs for a car.
  function carSummary(car, settings, today) {
    var p = profit(car);
    var shares = splitShares(p, settings);
    return {
      id: car.id,
      car: car,
      name: car.name,
      model_year: car.model_year,
      status: car.status,
      statusLabel: STATUS_LABEL[car.status] || car.status,
      purchasePrice: num(car.purchase_price),
      expensesTotal: expensesTotal(car),
      expensesByCategory: expensesByCategory(car),
      totalCost: totalCost(car),
      salePrice: num(car.sale_price),
      profit: p,
      profitEstimated: isProfitEstimated(car),
      myShare: shares.mine,
      partnerShare: shares.partner,
      roiPercent: roiPercent(car),
      daysHeld: daysHeld(car, today),
      isSold: car.status === 'sold',
      hasCostData: totalCost(car) !== null
    };
  }

  /* ---------- business-wide ----------------------------------------------- */

  function businessSummary(data, today) {
    var settings = (data && data.settings) || {};
    var cars = (data && data.cars) || [];
    var payouts = (data && data.payouts) || [];
    var capital = (data && data.capital) || [];

    var summaries = cars.map(function (c) { return carSummary(c, settings, today); });
    var sold = summaries.filter(function (s) { return s.isSold; });
    var unsold = summaries.filter(function (s) { return !s.isSold; });

    var totalCapitalInvested = sum(capital, function (c) { return c.amount; });
    var capitalDeployed = sum(unsold, function (s) { return s.totalCost; });
    var totalPaidToMe = sum(payouts, function (p) { return p.amount; });
    var capitalIdle = totalCapitalInvested - capitalDeployed - totalPaidToMe;

    var totalProfit = sum(sold, function (s) { return s.profit; });
    var splits = splitShares(totalProfit, settings);
    var myProfitEarned = splits.mine;
    var outstandingToMe = myProfitEarned - totalPaidToMe;

    var soldWithProfit = sold.filter(function (s) { return s.profit !== null; });
    var soldWithDays = sold.filter(function (s) { return s.daysHeld !== null; });
    var totalSaleValue = sum(sold, function (s) { return s.salePrice; });
    var totalSoldCost = sum(sold, function (s) { return s.totalCost; });

    return {
      settings: settings,
      cars: summaries,
      sold: sold,
      unsold: unsold,
      totalCapitalInvested: totalCapitalInvested,
      capitalDeployed: capitalDeployed,
      capitalIdle: capitalIdle,
      totalProfitAllTime: totalProfit,
      myProfitEarned: myProfitEarned,
      partnerProfitEarned: splits.partner,
      totalPaidToMe: totalPaidToMe,
      outstandingToMe: outstandingToMe,
      paidRatio: myProfitEarned > 0 ? Math.min(1, totalPaidToMe / myProfitEarned) : 0,
      carsSoldCount: sold.length,
      carsInStockCount: unsold.length,
      totalSaleValue: totalSaleValue,
      totalSoldCost: totalSoldCost,
      avgProfitPerCar: soldWithProfit.length ? totalProfit / soldWithProfit.length : null,
      avgDaysHeld: soldWithDays.length
        ? Math.round(sum(soldWithDays, function (s) { return s.daysHeld; }) / soldWithDays.length)
        : null,
      expenseTotalsByCategory: EXPENSE_CATEGORIES.reduce(function (acc, cat) {
        acc[cat] = sum(summaries, function (s) { return s.expensesByCategory[cat]; });
        return acc;
      }, {}),
      dataGaps: dataGaps(summaries)
    };
  }

  // Honest reporting: name every figure the dashboard is quietly guessing at.
  function dataGaps(summaries) {
    var gaps = [];
    var noPrice = summaries.filter(function (s) { return s.purchasePrice === null; });
    var estimated = summaries.filter(function (s) { return s.profitEstimated; });
    var noSalePrice = summaries.filter(function (s) { return s.isSold && s.salePrice === null; });
    if (noPrice.length) {
      gaps.push({
        key: 'purchase_price',
        count: noPrice.length,
        cars: noPrice.map(function (s) { return s.name; }),
        message: noPrice.length + ' car' + (noPrice.length > 1 ? 's have' : ' has') +
          ' no purchase price, so deployed capital is understated.'
      });
    }
    if (estimated.length) {
      gaps.push({
        key: 'profit_override',
        count: estimated.length,
        cars: estimated.map(function (s) { return s.name; }),
        message: estimated.length + ' sold car' + (estimated.length > 1 ? 's use' : ' uses') +
          ' a reported profit figure instead of real cost and sale numbers.'
      });
    }
    if (noSalePrice.length) {
      gaps.push({
        key: 'sale_price',
        count: noSalePrice.length,
        cars: noSalePrice.map(function (s) { return s.name; }),
        message: noSalePrice.length + ' sold car' + (noSalePrice.length > 1 ? 's have' : ' has') +
          ' no sale price recorded.'
      });
    }
    return gaps;
  }

  /* ---------- monthly report ---------------------------------------------- */

  function monthRange(data, today) {
    var keys = [];
    function push(v) { var k = monthKey(v); if (k) keys.push(k); }
    ((data && data.cars) || []).forEach(function (c) {
      push(c.purchase_date); push(c.sale_date);
      (c.expenses || []).forEach(function (e) { push(e.date); });
    });
    ((data && data.payouts) || []).forEach(function (p) { push(p.date); });
    ((data && data.capital) || []).forEach(function (c) { push(c.date); });
    push(today || new Date().toISOString().slice(0, 10));
    if (!keys.length) return [];

    keys.sort();
    var out = [], cursor = keys[0], last = keys[keys.length - 1], guard = 0;
    while (cursor <= last && guard++ < 600) {
      out.push(cursor);
      var y = Number(cursor.slice(0, 4)), m = Number(cursor.slice(5, 7)) + 1;
      if (m > 12) { m = 1; y += 1; }
      cursor = y + '-' + String(m).padStart(2, '0');
    }
    return out;
  }

  // One row per month, with the running outstanding balance carried forward.
  // This is the "total month record system".
  function monthlyReport(data, today) {
    var settings = (data && data.settings) || {};
    var cars = (data && data.cars) || [];
    var payouts = (data && data.payouts) || [];
    var capital = (data && data.capital) || [];
    var months = monthRange(data, today);

    var runningOutstanding = 0;
    var runningProfit = 0;

    return months.map(function (key) {
      var bought = cars.filter(function (c) { return monthKey(c.purchase_date) === key; });
      var sold = cars.filter(function (c) { return c.status === 'sold' && monthKey(c.sale_date) === key; });
      var soldSummaries = sold.map(function (c) { return carSummary(c, settings, today); });

      var monthProfit = sum(soldSummaries, function (s) { return s.profit; });
      var myShare = splitShares(monthProfit, settings).mine || 0;
      var paid = sum(payouts.filter(function (p) { return monthKey(p.date) === key; }),
        function (p) { return p.amount; });
      var capitalIn = sum(capital.filter(function (c) { return monthKey(c.date) === key; }),
        function (c) { return c.amount; });
      var expenses = 0;
      cars.forEach(function (c) {
        (c.expenses || []).forEach(function (e) {
          if (monthKey(e.date) === key) expenses += (num(e.amount) || 0);
        });
      });

      runningProfit += monthProfit;
      runningOutstanding += myShare - paid;

      return {
        key: key,
        label: monthLabel(key),
        carsBought: bought.length,
        carsBoughtNames: bought.map(function (c) { return c.name; }),
        carsSold: sold.length,
        carsSoldNames: sold.map(function (c) { return c.name; }),
        saleValue: sum(soldSummaries, function (s) { return s.salePrice; }),
        cost: sum(soldSummaries, function (s) { return s.totalCost; }),
        spendOnRepairs: expenses,
        capitalIn: capitalIn,
        profit: monthProfit,
        cumulativeProfit: runningProfit,
        myShare: myShare,
        paid: paid,
        outstanding: runningOutstanding,
        isEmpty: !bought.length && !sold.length && !paid && !capitalIn && !expenses
      };
    });
  }

  /* ---------- activity timeline ------------------------------------------- */

  function timeline(data, limit) {
    var events = [];
    ((data && data.cars) || []).forEach(function (c) {
      if (c.purchase_date) {
        events.push({
          date: c.purchase_date, type: 'bought', icon: 'car-front', carId: c.id,
          title: c.name + ' bought',
          amount: num(c.purchase_price),
          detail: num(c.purchase_price) === null ? 'Purchase price not recorded yet' : null
        });
      }
      (c.expenses || []).forEach(function (e) {
        events.push({
          date: e.date, type: 'expense', icon: 'wrench', carId: c.id,
          title: c.name + ' — ' + (e.category || 'other'),
          amount: num(e.amount), detail: e.note || null
        });
      });
      if (c.status === 'sold' && c.sale_date) {
        var p = profit(c);
        events.push({
          date: c.sale_date, type: 'sold', icon: 'trending-up', carId: c.id,
          title: c.name + ' sold',
          amount: num(c.sale_price),
          profit: p,
          detail: num(c.sale_price) === null
            ? 'Sale price not recorded' + (p === null ? '' : ' · reported profit')
            : (p === null ? null : (p >= 0 ? 'Profit ' : 'Loss ') + formatPKR(Math.abs(p)))
        });
      }
    });
    ((data && data.payouts) || []).forEach(function (p) {
      events.push({
        date: p.date, type: 'payout', icon: 'banknote', carId: p.car_id || null,
        title: 'Payout received', amount: num(p.amount), detail: p.note || null
      });
    });
    ((data && data.capital) || []).forEach(function (c) {
      events.push({
        date: c.date, type: 'capital', icon: 'wallet', carId: null,
        title: 'Capital added', amount: num(c.amount), detail: c.note || null
      });
    });
    events.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return limit ? events.slice(0, limit) : events;
  }

  /* ---------- csv --------------------------------------------------------- */

  function toCSV(rows, columns) {
    function cell(v) {
      if (v === null || v === undefined) return '';
      var s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var head = columns.map(function (c) { return cell(c.label); }).join(',');
    var body = rows.map(function (r) {
      return columns.map(function (c) { return cell(c.value(r)); }).join(',');
    });
    return [head].concat(body).join('\n');
  }

  return {
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    STATUSES: STATUSES,
    STATUS_LABEL: STATUS_LABEL,
    num: num, sum: sum, parseDate: parseDate, monthKey: monthKey, monthLabel: monthLabel,
    daysBetween: daysBetween,
    formatNumber: formatNumber, formatPKR: formatPKR, formatPKRLong: formatPKRLong,
    shorthand: shorthand, formatPercent: formatPercent, formatDate: formatDate,
    expensesTotal: expensesTotal, expensesByCategory: expensesByCategory,
    totalCost: totalCost, profit: profit, isProfitEstimated: isProfitEstimated,
    splitShares: splitShares, roiPercent: roiPercent, daysHeld: daysHeld,
    carSummary: carSummary, businessSummary: businessSummary, dataGaps: dataGaps,
    monthRange: monthRange, monthlyReport: monthlyReport, timeline: timeline,
    toCSV: toCSV
  };
}));
