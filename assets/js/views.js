/* =============================================================================
   views.js — cars, car detail, payouts, capital and settings screens.
   Extends window.Render (split out of render.js to keep each file readable).
   ============================================================================= */
(function (root) {
  'use strict';

  var C = root.Calc;
  var R = root.Render;
  var Art = root.Art;
  var Charts = root.Charts;
  var h = R.h, icon = R.icon, money = R.money, signed = R.signed;

  function readonlyNote(state) {
    if (state.canWrite) return '';
    return '<div class="banner" data-tone="info">' + icon('lock') +
      '<div><div class="banner-title">Read-only</div>' +
      'Connect a GitHub token in Settings to add or change anything.</div>' +
      '<div class="banner-actions"><button class="btn btn-sm" data-action="go-settings">' +
      icon('settings') + 'Settings</button></div></div>';
  }

  function addButton(label, action, enabled) {
    return '<button class="btn btn-primary" data-action="' + h(action) + '"' +
      (enabled ? '' : ' disabled title="Connect a token to edit"') + '>' +
      icon('plus') + h(label) + '</button>';
  }

  /* ---------- 2. cars ------------------------------------------------------ */

  function carFilters(state) {
    var f = state.filters;
    var years = [];
    state.summary.cars.forEach(function (c) {
      if (c.model_year && years.indexOf(c.model_year) === -1) years.push(c.model_year);
    });
    years.sort(function (a, b) { return b - a; });

    var statuses = [{ key: 'all', label: 'All' }].concat(
      C.STATUSES.map(function (s) { return { key: s, label: C.STATUS_LABEL[s] }; })
    );

    return '' +
      '<div class="card"><div class="card-body" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
          statuses.map(function (s) {
            var count = s.key === 'all' ? state.summary.cars.length
              : state.summary.cars.filter(function (c) { return c.status === s.key; }).length;
            return '<button type="button" class="chip" data-filter-status="' + h(s.key) + '"' +
              ' aria-pressed="' + (f.status === s.key) + '">' + h(s.label) +
              ' <span class="muted num">' + count + '</span></button>';
          }).join('') +
        '</div>' +
        (f.month ? '<button type="button" class="chip" aria-pressed="true" data-action="clear-month">' +
          icon('calendar') + h(C.monthLabel(f.month)) + ' ' + icon('x') + '</button>' : '') +
        '<div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          (years.length ? '<select data-filter-year aria-label="Filter by model year">' +
            '<option value="all">All years</option>' +
            years.map(function (y) {
              return '<option value="' + y + '"' + (String(f.year) === String(y) ? ' selected' : '') + '>' + y + '</option>';
            }).join('') + '</select>' : '') +
          '<select data-filter-sort aria-label="Sort cars">' +
            [['profit', 'Highest profit'], ['profit-asc', 'Lowest profit'],
             ['recent', 'Most recent'], ['days', 'Longest held'], ['name', 'Name A–Z']]
            .map(function (o) {
              return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') +
          '</select>' +
          '<div class="seg" role="group" aria-label="Layout">' +
            '<button type="button" data-layout="grid" aria-pressed="' + (f.layout === 'grid') + '">' +
              icon('layout-grid') + 'Cards</button>' +
            '<button type="button" data-layout="table" aria-pressed="' + (f.layout === 'table') + '">' +
              icon('table-2') + 'Table</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  }

  function filterCars(state) {
    var f = state.filters;
    var list = state.summary.cars.slice();

    if (f.status !== 'all') list = list.filter(function (c) { return c.status === f.status; });
    if (f.year && f.year !== 'all') {
      list = list.filter(function (c) { return String(c.model_year) === String(f.year); });
    }
    if (f.month) {
      list = list.filter(function (c) {
        return C.monthKey(c.car.purchase_date) === f.month || C.monthKey(c.car.sale_date) === f.month;
      });
    }

    var sorters = {
      profit: function (a, b) { return (b.profit === null ? -Infinity : b.profit) - (a.profit === null ? -Infinity : a.profit); },
      'profit-asc': function (a, b) { return (a.profit === null ? Infinity : a.profit) - (b.profit === null ? Infinity : b.profit); },
      recent: function (a, b) { return String(b.car.purchase_date || '').localeCompare(String(a.car.purchase_date || '')); },
      days: function (a, b) { return (b.daysHeld || 0) - (a.daysHeld || 0); },
      name: function (a, b) { return String(a.name).localeCompare(String(b.name)); }
    };
    return list.sort(sorters[f.sort] || sorters.profit);
  }

  function carCard(c) {
    var thumb = c.car.image_url
      ? '<img src="' + h(c.car.image_url) + '" alt="' + h(c.name) + '" loading="lazy" ' +
        'onerror="this.replaceWith(document.createRange().createContextualFragment(window.Art.carSilhouette(\'' +
        R.statusTint(c.status) + '\')))">'
      : Art.carSilhouette(R.statusTint(c.status));

    return '' +
      '<button type="button" class="car-card" data-car="' + h(c.id) + '">' +
        '<span class="car-thumb">' + thumb +
          '<span class="badge" data-status="' + h(c.status) + '">' + h(c.statusLabel) + '</span>' +
          (c.daysHeld === null ? '' : '<span class="thumb-days">' + c.daysHeld + 'd</span>') +
        '</span>' +
        '<span class="car-card-body">' +
          '<span class="car-card-title"><h3>' + h(c.name) + '</h3>' +
            '<span class="yr">' + (c.model_year ? h(c.model_year) : 'year ?') + '</span></span>' +
          '<span class="car-card-figs">' +
            '<span class="fig"><span class="fig-label">' + (c.isSold ? 'Profit' : 'Tied up') + '</span>' +
              '<span class="fig-value">' + (c.isSold ? signed(c.profit) : money(c.totalCost)) + '</span></span>' +
            '<span class="fig fig-end"><span class="fig-label">' +
              (c.isSold ? 'Your half' : 'Spent on it') + '</span>' +
              '<span class="fig-value">' + (c.isSold ? money(c.myShare) : money(c.expensesTotal || null)) +
              '</span></span>' +
          '</span>' +
          (c.profitEstimated ? '<span class="badge badge-est">' + icon('alert-circle') + 'reported figure</span>' : '') +
        '</span>' +
      '</button>';
  }

  function carsTable(list) {
    return '<div class="table-scroll"><table><thead><tr>' +
      '<th>Car</th><th>Status</th><th class="right">Purchase</th><th class="right">Expenses</th>' +
      '<th class="right">Total cost</th><th class="right">Sale</th><th class="right">Profit</th>' +
      '<th class="right">Your half</th><th class="right">ROI</th><th class="right">Days</th>' +
      '</tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr data-clickable data-car="' + h(c.id) + '">' +
          '<td><span class="cell-main"><span class="cell-stack">' +
            '<span class="cell-title">' + h(c.name) + '</span> ' +
            '<span class="cell-note">' + (c.model_year ? h(c.model_year) : 'year not set') +
            '</span></span></span></td>' +
          '<td>' + R.statusBadge(c.status, c.profitEstimated) + '</td>' +
          '<td class="right">' + money(c.purchasePrice) + '</td>' +
          '<td class="right">' + money(c.expensesTotal || null) + '</td>' +
          '<td class="right">' + money(c.totalCost) + '</td>' +
          '<td class="right">' + money(c.salePrice) + '</td>' +
          '<td class="right">' + signed(c.profit) + '</td>' +
          '<td class="right">' + money(c.myShare) + '</td>' +
          '<td class="right">' + (c.roiPercent === null ? '<span class="muted">—</span>' :
            '<span class="num">' + C.formatPercent(c.roiPercent) + '</span>') + '</td>' +
          '<td class="right">' + (c.daysHeld === null ? '<span class="muted">—</span>' :
            '<span class="num">' + c.daysHeld + '</span>') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function cars(state) {
    var list = filterCars(state);
    var body;

    if (!list.length) {
      body = '<div class="card"><div class="card-body">' + R.emptyState(
        Art.emptyCars,
        state.summary.cars.length ? 'No cars match this filter' : 'No cars yet',
        state.summary.cars.length
          ? 'Try clearing the filters above.'
          : 'Add the first car Usama bought — purchase price, date, and what it cost to fix.',
        state.summary.cars.length
          ? '<button class="btn" data-action="clear-filters">' + icon('rotate-ccw') + 'Clear filters</button>'
          : (state.canWrite ? addButton('Add the first car', 'add-car', true) : '')
      ) + '</div></div>';
    } else {
      body = state.filters.layout === 'grid'
        ? '<div class="car-grid">' + list.map(carCard).join('') + '</div>'
        : '<div class="card"><div class="card-body flush">' + carsTable(list) + '</div></div>';
    }

    return readonlyNote(state) + carFilters(state) + body;
  }

  /* ---------- 3. car detail ------------------------------------------------ */

  function field(label, name, value, opts) {
    opts = opts || {};
    var attrs = 'data-field="' + h(name) + '"' + (opts.disabled ? ' disabled' : '');
    var input;
    if (opts.type === 'select') {
      input = '<select ' + attrs + '>' + opts.options.map(function (o) {
        return '<option value="' + h(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') +
          '>' + h(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (opts.type === 'textarea') {
      input = '<textarea ' + attrs + ' placeholder="' + h(opts.placeholder || '') + '">' + h(value || '') + '</textarea>';
    } else {
      input = '<input type="' + (opts.type || 'text') + '" ' + attrs +
        (opts.type === 'number' ? ' class="money" inputmode="numeric" step="1"' : '') +
        ' value="' + h(value === null || value === undefined ? '' : value) + '"' +
        ' placeholder="' + h(opts.placeholder || '') + '">';
    }
    return '<div class="field' + (opts.span2 ? ' span-2' : '') + '">' +
      '<label>' + h(label) + '</label>' + input +
      (opts.hint ? '<div class="hint">' + h(opts.hint) + '</div>' : '') + '</div>';
  }

  // Shown on the car detail page whenever the partner put money into a car, and
  // as an always-present pair of fields so the split can be recorded.
  function fundingPanel(c, settings, can) {
    var investor = settings.investor_name || 'You';
    var partner = settings.partner_name || 'Partner';
    var f = c.funding;
    var shared = f.recorded && f.partner > 0;

    return '' +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Who paid for this car</h2>' +
          '<div class="sub">' + (shared
            ? 'Funded by both of you, so this car does not divide 50/50'
            : 'Leave both blank when you paid for all of it') + '</div></div></div>' +
        '<div class="card-body">' +
          '<form data-form="funding" class="form-grid">' +
            field(h(investor) + '’s money', 'funding_investor', f.recorded ? f.investor : null,
              { type: 'number', disabled: !can, placeholder: 'PKR' }) +
            field(h(partner) + '’s money', 'funding_partner', f.recorded ? f.partner : null,
              { type: 'number', disabled: !can, placeholder: 'PKR' }) +
          '</form>' +
          (c.fundingMismatch !== null
            ? '<div class="banner" data-tone="warn" style="margin-top:12px">' + icon('alert-triangle') +
              '<div>These add up to ' + C.formatPKR(f.total) + ', but the car cost ' +
              C.formatPKR(c.totalCost) + ' — a difference of ' +
              C.formatPKR(Math.abs(c.fundingMismatch)) + '.</div></div>'
            : '') +
          '<div class="split-bar" style="margin-top:14px">' +
            '<div class="split-track">' +
              '<div class="split-fill" style="width:' + c.investorPercent.toFixed(2) + '%"></div>' +
            '</div>' +
            '<div class="progress-legend">' +
              '<span>' + h(investor) + ' <b>' + C.formatPercent(c.investorPercent) + '</b>\u00a0</span>' +
              '<span>' + h(partner) + ' <b>' + C.formatPercent(c.partnerPercent) + '</b>\u00a0</span>' +
              '<span class="muted">of this car’s profit</span>' +
            '</div>' +
          '</div>' +
          (shared
            ? '<div class="hint" style="margin-top:10px">' +
              'Half the profit rewards the money and splits ' +
              C.formatPercent(f.investorFraction * 100, 0) + ' / ' +
              C.formatPercent(100 - f.investorFraction * 100, 0) + ' the way it was funded. ' +
              'The other half rewards the work and goes to ' + h(partner) + '.</div>'
            : '<div class="hint" style="margin-top:10px">' +
              'You funded this one alone, so it splits on your normal ' +
              C.formatPercent(c.investorPercent, 0) + ' / ' +
              C.formatPercent(c.partnerPercent, 0) + ' agreement.</div>') +
        '</div>' +
      '</div>';
  }

  function waterfall(c, settings) {
    var t = Charts.theme();
    var rows = '';

    rows += '<div class="wf-row"><span class="wf-label">' +
      '<span class="wf-swatch" style="background:' + t.series[0] + '"></span>Purchase price</span>' +
      '<span class="wf-value">' + money(c.purchasePrice) + '</span></div>';

    C.EXPENSE_CATEGORIES.forEach(function (cat, i) {
      var v = c.expensesByCategory[cat];
      if (!v) return;
      rows += '<div class="wf-row is-sub"><span class="wf-label">' +
        '<span class="wf-swatch" style="background:' + t.series[(i + 1) % 8] + '"></span>' +
        h(cat.charAt(0).toUpperCase() + cat.slice(1)) + '</span>' +
        '<span class="wf-value">+ ' + C.formatNumber(v) + '</span></div>';
    });

    rows += '<div class="wf-row is-total"><span class="wf-label">Total cost</span>' +
      '<span class="wf-value">' + money(c.totalCost) + '</span></div>';

    rows += '<div class="wf-row"><span class="wf-label">Sale price</span>' +
      '<span class="wf-value">' + money(c.salePrice) + '</span></div>';

    var profitClass = c.profit !== null && c.profit < 0 ? ' is-profit neg' : ' is-profit';
    rows += '<div class="wf-row' + (c.profit === null ? '' : profitClass) + '">' +
      '<span class="wf-label">' + icon(c.profit !== null && c.profit < 0 ? 'trending-down' : 'trending-up') +
      'Profit</span><span class="wf-value">' + signed(c.profit) + '</span></div>';

    var investor = settings.investor_name || 'You';
    var partner = settings.partner_name || 'Partner';
    rows += '<div class="wf-row is-sub"><span class="wf-label">' + h(investor) + '’s share (' +
      C.formatPercent(c.investorPercent) + ')</span>' +
      '<span class="wf-value">' + money(c.myShare) + '</span></div>';
    rows += '<div class="wf-row is-sub"><span class="wf-label">' + h(partner) + '’s share (' +
      C.formatPercent(c.partnerPercent) + ')</span>' +
      '<span class="wf-value">' + money(c.partnerShare) + '</span></div>';

    return '<div class="waterfall">' + rows + '</div>';
  }

  function carDetail(state, carId) {
    var car = state.data.cars.filter(function (x) { return x.id === carId; })[0];
    if (!car) {
      return '<div class="card"><div class="card-body">' + R.emptyState(
        Art.emptyCars, 'Car not found',
        'It may have been deleted. Go back to the cars list.',
        '<button class="btn" data-action="go-cars">' + icon('arrow-left') + 'All cars</button>'
      ) + '</div></div>';
    }

    var c = C.carSummary(car, state.data.settings, state.today);
    var can = state.canWrite;
    var thumb = car.image_url
      ? '<img src="' + h(car.image_url) + '" alt="' + h(car.name) + '">'
      : Art.carSilhouette(R.statusTint(car.status));

    var expenses = (car.expenses || []).slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });

    var expenseList = expenses.length
      ? expenses.map(function (e) {
          return '<div class="expense-row">' +
            '<span class="muted">' + h(C.formatDate(e.date)) + '</span>' +
            '<span>' + h(e.category || 'other') +
              (e.note ? ' <span class="muted">· ' + h(e.note) + '</span>' : '') + '</span>' +
            '<span class="amt">' + C.formatNumber(e.amount) + '</span>' +
            (can ? '<button class="btn btn-ghost btn-sm" data-action="delete-expense" ' +
              'data-expense="' + h(e.id) + '" aria-label="Delete expense">' + icon('trash-2') + '</button>'
              : '<span></span>') +
          '</div>';
        }).join('')
      : '<p class="muted" style="margin:4px 0 0">Nothing spent on this car yet.</p>';

    var left = fundingPanel(c, state.data.settings, can) +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Cost breakdown</h2>' +
          '<div class="sub">Purchase price, then every rupee spent, then what came back.</div></div></div>' +
        '<div class="card-body">' +
          waterfall(c, state.data.settings) +
          (c.roiPercent !== null || c.daysHeld !== null ?
            '<dl class="kv" style="margin-top:14px">' +
              (c.roiPercent !== null ? '<dt>Return on cost</dt><dd>' + C.formatPercent(c.roiPercent) + '</dd>' : '') +
              (c.daysHeld !== null ? '<dt>' + (c.isSold ? 'Held for' : 'Held so far') + '</dt><dd>' +
                c.daysHeld + ' days</dd>' : '') +
            '</dl>' : '') +
          (c.profitEstimated ?
            '<div class="banner" data-tone="warn" style="margin-top:14px">' + icon('alert-circle') +
            '<div>This profit is the figure your partner reported (' + C.formatPKR(c.profit) + '), not a ' +
            'calculation. Enter the real purchase price and sale price and it will be computed properly.</div></div>' : '') +
        '</div>' +
      '</div>' +
      ((c.purchasePrice !== null || c.expensesTotal > 0) ? R.chartCard({
        key: 'costBreakdown',
        title: 'Anatomy of this deal',
        sub: 'Every component of the cost, plus the margin.',
        legend: Charts.legendHTML((function () {
          var t = Charts.theme(), out = [];
          if (c.purchasePrice !== null) out.push({ label: 'Purchase price', color: t.series[0], value: C.formatPKR(c.purchasePrice) });
          C.EXPENSE_CATEGORIES.forEach(function (cat, i) {
            if (c.expensesByCategory[cat] > 0) {
              out.push({ label: cat.charAt(0).toUpperCase() + cat.slice(1), color: t.series[(i + 1) % 8],
                         value: C.formatPKR(c.expensesByCategory[cat]) });
            }
          });
          if (c.profit !== null && c.profit > 0) out.push({ label: 'Profit margin', color: t.series[2], value: C.formatPKR(c.profit) });
          return out;
        }())),
        table: R.simpleTable([{ label: 'Component' }, { label: 'Amount', right: true }],
          (function () {
            var rows = [];
            if (c.purchasePrice !== null) rows.push(['Purchase price', C.formatNumber(c.purchasePrice)]);
            C.EXPENSE_CATEGORIES.forEach(function (cat) {
              if (c.expensesByCategory[cat] > 0) {
                rows.push([cat.charAt(0).toUpperCase() + cat.slice(1), C.formatNumber(c.expensesByCategory[cat])]);
              }
            });
            if (c.profit !== null && c.profit > 0) rows.push(['Profit margin', C.formatNumber(c.profit)]);
            return rows;
          }()))
      }) : '') +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Money spent on this car</h2>' +
          '<div class="sub">' + C.formatPKRLong(c.expensesTotal) + ' across ' + expenses.length +
          ' entr' + (expenses.length === 1 ? 'y' : 'ies') + '</div></div>' +
          '<div class="card-head-actions">' +
            '<button class="btn btn-sm" data-action="add-expense"' + (can ? '' : ' disabled') + '>' +
            icon('plus') + 'Add expense</button></div>' +
        '</div>' +
        '<div class="card-body">' + expenseList + '</div>' +
      '</div>';

    var right = '' +
      '<div class="card">' +
        '<div class="car-thumb" style="border-radius:var(--r-lg) var(--r-lg) 0 0;aspect-ratio:16/9">' + thumb + '</div>' +
        '<div class="card-body">' +
          '<form data-form="car" class="form-grid">' +
            field('Car name', 'name', car.name, { disabled: !can }) +
            field('Model year', 'model_year', car.model_year, { type: 'number', disabled: !can }) +
            field('Status', 'status', car.status, {
              type: 'select', disabled: !can,
              options: C.STATUSES.map(function (s) { return [s, C.STATUS_LABEL[s]]; })
            }) +
            field('Registration', 'registration', car.registration, { disabled: !can, placeholder: 'e.g. LEA-1234' }) +
            field('Purchase date', 'purchase_date', car.purchase_date, { type: 'date', disabled: !can }) +
            field('Purchase price', 'purchase_price', car.purchase_price, {
              type: 'number', disabled: !can, placeholder: 'PKR', hint: 'What Usama paid for it'
            }) +
            field('Sale date', 'sale_date', car.sale_date, { type: 'date', disabled: !can }) +
            field('Sale price', 'sale_price', car.sale_price, { type: 'number', disabled: !can, placeholder: 'PKR' }) +
            field('Photo URL', 'image_url', car.image_url, {
              span2: true, disabled: !can,
              placeholder: 'https://…', hint: 'Paste any image link — OLX, PakWheels, Magnific, Unsplash'
            }) +
            field('Buyer note', 'buyer_note', car.buyer_note, { span2: true, disabled: !can }) +
            field('Notes', 'notes', car.notes, { type: 'textarea', span2: true, disabled: !can }) +
          '</form>' +
          (can ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
            '<button class="btn btn-primary" data-action="save-car">' + icon('check') + 'Save changes</button>' +
            (car.status !== 'sold'
              ? '<button class="btn" data-action="mark-sold">' + icon('banknote') + 'Mark as sold</button>' : '') +
            '<button class="btn btn-danger" style="margin-left:auto" data-action="delete-car">' +
              icon('trash-2') + 'Delete</button>' +
          '</div>' : '') +
        '</div>' +
      '</div>';

    return '' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" data-action="go-cars">' + icon('arrow-left') + 'All cars</button>' +
        R.statusBadge(car.status, c.profitEstimated) +
        (car.needs_confirmation ? '<span class="badge badge-est">' + icon('help-circle') +
          'dates unconfirmed</span>' : '') +
      '</div>' +
      readonlyNote(state) +
      '<div class="detail-grid">' + left + right + '</div>';
  }

  function mountCarDetail(state, carId) {
    var car = state.data.cars.filter(function (x) { return x.id === carId; })[0];
    if (!car) return;
    var canvas = document.getElementById('canvas-costBreakdown');
    if (canvas) Charts.costBreakdown(canvas, C.carSummary(car, state.data.settings, state.today));
  }

  /* ---------- 4. payouts --------------------------------------------------- */

  function payouts(state) {
    var s = state.summary;
    var list = state.data.payouts.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    var carName = {};
    state.data.cars.forEach(function (c) { carName[c.id] = c.name; });

    var stats = '<div class="stat-grid">' +
      R.statCard({
        icon: 'alert-circle', label: 'Still owed to you', className: 'stat-hero',
        value: C.formatPKR(s.outstandingToMe), countTo: s.outstandingToMe, prefix: 'PKR ',
        sub: 'Earned ' + C.formatPKR(s.myProfitEarned) + ' · received ' + C.formatPKR(s.totalPaidToMe)
      }) +
      R.statCard({
        icon: 'banknote', label: 'Total received',
        value: C.formatPKR(s.totalPaidToMe), countTo: s.totalPaidToMe, prefix: 'PKR ',
        sub: list.length + ' payment' + (list.length === 1 ? '' : 's')
      }) +
      R.statCard({
        icon: 'percent', label: 'Share actually paid',
        value: (s.paidRatio * 100).toFixed(1) + '%',
        sub: 'of the profit share you have earned'
      }) +
    '</div>';

    var body = list.length
      ? '<div class="card-body flush">' + R.simpleTable(
          [{ label: 'Date' }, { label: 'Amount', right: true }, { label: 'Method' },
           { label: 'For' }, { label: 'Note' }, { label: '', right: true }],
          list.map(function (p) {
            return [
              h(C.formatDate(p.date)),
              '<span class="pos num">+' + C.formatNumber(p.amount) + '</span>',
              h(p.method || '—'),
              p.car_id && carName[p.car_id] ? h(carName[p.car_id]) : '<span class="muted">lump sum</span>',
              h(p.note || ''),
              state.canWrite ? '<button class="btn btn-ghost btn-sm" data-action="delete-payout" ' +
                'data-payout="' + h(p.id) + '" aria-label="Delete payout">' + icon('trash-2') + '</button>' : ''
            ];
          })
        ) + '</div>'
      : '<div class="card-body">' + R.emptyState(
          Art.emptyPayouts, 'No payments recorded',
          'When Usama transfers your profit share, log it here. The outstanding figure updates instantly.',
          state.canWrite ? addButton('Record a payment', 'add-payout', true) : ''
        ) + '</div>';

    return readonlyNote(state) + stats +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Payments received</h2>' +
          '<div class="sub">Money that actually reached your account</div></div>' +
          '<div class="card-head-actions">' + addButton('Record a payment', 'add-payout', state.canWrite) + '</div>' +
        '</div>' + body +
      '</div>';
  }

  /* ---------- 5. capital --------------------------------------------------- */

  function capital(state) {
    var s = state.summary;
    var list = state.data.capital.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    var stats = '<div class="stat-grid">' +
      R.statCard({
        icon: 'landmark', label: 'Total invested', className: 'stat-hero',
        value: C.formatPKR(s.totalCapitalInvested), countTo: s.totalCapitalInvested, prefix: 'PKR ',
        sub: h(C.shorthand(s.totalCapitalInvested)) + ' across ' + list.length +
             ' entr' + (list.length === 1 ? 'y' : 'ies')
      }) +
      R.statCard({
        icon: 'package', label: 'Tied up in unsold cars',
        value: C.formatPKR(s.capitalDeployed), countTo: s.capitalDeployed, prefix: 'PKR ',
        sub: s.carsInStockCount + ' car' + (s.carsInStockCount === 1 ? '' : 's') + ' holding it',
        foot: s.dataGaps.length ? icon('alert-triangle') + 'Understated — some purchase prices are missing' : ''
      }) +
      R.statCard({
        icon: 'piggy-bank', label: 'Not working',
        value: C.formatPKR(s.capitalIdle), countTo: s.capitalIdle, prefix: 'PKR ',
        sub: 'Invested − tied up − returned to you'
      }) +
    '</div>';

    var body = list.length
      ? '<div class="card-body flush">' + R.simpleTable(
          [{ label: 'Date' }, { label: 'Amount', right: true }, { label: 'Note' }, { label: '', right: true }],
          list.map(function (c) {
            return [
              h(C.formatDate(c.date)),
              '<span class="num">' + C.formatNumber(c.amount) + '</span>',
              h(c.note || ''),
              state.canWrite ? '<button class="btn btn-ghost btn-sm" data-action="delete-capital" ' +
                'data-capital="' + h(c.id) + '" aria-label="Delete entry">' + icon('trash-2') + '</button>' : ''
            ];
          })
        ) + '</div>'
      : '<div class="card-body">' + R.emptyState(
          Art.emptyCapital, 'No capital recorded',
          'Add each transfer you made into the business so the tracker knows how much is yours.',
          state.canWrite ? addButton('Add capital', 'add-capital', true) : ''
        ) + '</div>';

    return readonlyNote(state) + stats +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Money you put in</h2>' +
          '<div class="sub">Your capital injections, dated</div></div>' +
          '<div class="card-head-actions">' + addButton('Add capital', 'add-capital', state.canWrite) + '</div>' +
        '</div>' + body +
      '</div>';
  }

  /* ---------- 6. settings -------------------------------------------------- */

  function settings(state) {
    var cfg = root.Store.config;
    var st = state.data.settings;
    var mode = state.mode;

    var modeCopy = {
      live: ['Connected', 'Reading and writing ' + h(cfg.owner) + '/' + h(cfg.repo) +
             ' on branch ' + h(cfg.branch) + '.'],
      readonly: ['Read-only', 'Showing the JSON files from this site. Add a token to make changes.'],
      demo: ['Preview mode', 'Running on bundled sample data. Changes are kept in this browser only ' +
             'and are never sent anywhere.']
    }[mode];

    // Say up front when this copy of the app physically cannot reach GitHub, rather
    // than letting the person fill in a token and hit an opaque failure.
    var unreachable = (mode !== 'live') && !root.Store.canReachGitHub();
    var blockedBanner = unreachable
      ? '<div class="banner" data-tone="danger" style="margin-bottom:14px">' + icon('alert-triangle') +
        '<div><div class="banner-title">This copy cannot connect to GitHub</div>' +
        h(root.Store.networkHint()) + '</div></div>'
      : '';

    return '' +
      '<div class="card">' +
        '<div class="card-head"><div><h2>GitHub connection</h2>' +
          '<div class="sub">Your token is stored in this browser only. It is never written into the repo.</div></div>' +
        '</div>' +
        '<div class="card-body">' +
          blockedBanner +
          '<div class="banner" data-tone="' + (mode === 'live' ? 'info' : 'warn') + '" style="margin-bottom:14px">' +
            icon(mode === 'live' ? 'check-circle' : 'info') +
            '<div><div class="banner-title">' + modeCopy[0] + '</div>' + modeCopy[1] + '</div></div>' +
          '<form data-form="connection" class="form-grid">' +
            field('GitHub username', 'owner', cfg.owner, { placeholder: 'waqarsheikh07' }) +
            field('Repository', 'repo', cfg.repo, { placeholder: 'Car-Hisaab' }) +
            field('Branch', 'branch', cfg.branch, { placeholder: 'main' }) +
            field('Data folder', 'dataPath', cfg.dataPath, { placeholder: 'data', hint: 'Where the JSON files live' }) +
            // The token value is deliberately NOT rendered. Putting a secret in a
            // value attribute puts it in the page source, in devtools, and in any
            // screenshot of them. Blank means "keep the one already saved".
            field('Personal access token', 'token', '', {
              type: 'password', span2: true,
              placeholder: cfg.token ? 'Saved — leave blank to keep it' : 'github_pat_…',
              hint: cfg.token
                ? 'A token is saved in this browser. Type a new one only to replace it.'
                : 'Fine-grained token, this repository only, Contents: Read and write'
            }) +
          '</form>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
            '<button class="btn btn-primary" data-action="test-connection">' + icon('plug') + 'Test &amp; connect</button>' +
            '<button class="btn" data-action="reload-data">' + icon('refresh-cw') + 'Reload data</button>' +
            (cfg.token ? '<button class="btn btn-danger" style="margin-left:auto" data-action="disconnect">' +
              icon('log-out') + 'Disconnect token</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><div><h2>Profit split</h2>' +
          '<div class="sub">Used everywhere “your share” appears</div></div></div>' +
        '<div class="card-body">' +
          '<form data-form="settings" class="form-grid">' +
            field('Your name', 'investor_name', st.investor_name, {}) +
            field('Partner name', 'partner_name', st.partner_name, {}) +
            field('Your share %', 'profit_split_investor', st.profit_split_investor, {
              type: 'number', hint: 'When you fund the car alone' }) +
            field('Partner share %', 'profit_split_partner', st.profit_split_partner, { type: 'number' }) +
            field('Of profit, how much rewards the money %', 'capital_reward_percent',
              st.capital_reward_percent === undefined ? 50 : st.capital_reward_percent, {
                span2: true, type: 'number',
                hint: 'The rest rewards the work. Only matters on cars ' +
                      h(st.partner_name || 'your partner') + ' helped pay for.'
              }) +
          '</form>' +
          '<div class="banner" data-tone="info" style="margin-top:14px">' + icon('info') +
            '<div><div class="banner-title">How a shared car divides</div>' +
            'Profit splits into two pots. The <b>money pot</b> (' +
            (st.capital_reward_percent === undefined ? 50 : st.capital_reward_percent) +
            '% of profit) is divided exactly the way the car was paid for, so every ' +
            'rupee either of you put in earns the same rate. The <b>work pot</b> (the rest) ' +
            'goes to ' + h(st.partner_name || 'your partner') + ' for sourcing, fixing and ' +
            'selling it. On a car you paid for alone this lands on ' +
            (st.profit_split_investor === undefined ? 50 : st.profit_split_investor) + '/' +
            (st.profit_split_partner === undefined ? 50 : st.profit_split_partner) +
            ' exactly as before.</div></div>' +
          '<div style="margin-top:14px">' +
            '<button class="btn btn-primary" data-action="save-settings"' +
              (state.canWrite ? '' : ' disabled') + '>' + icon('check') + 'Save split</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><div><h2>Export</h2>' +
          '<div class="sub">Take your data anywhere</div></div></div>' +
        '<div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn" data-action="export-json">' + icon('download') + 'Full JSON backup</button>' +
          '<button class="btn" data-action="export-csv">' + icon('table-2') + 'Monthly report CSV</button>' +
          '<button class="btn" data-action="export-cars-csv">' + icon('car-front') + 'Cars CSV</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><div><h2>Appearance</h2></div></div>' +
        '<div class="card-body">' +
          '<label class="switch"><input type="checkbox" data-action="toggle-theme"' +
            (state.theme === 'dark' ? ' checked' : '') + '>' +
            '<span class="switch-track"></span><span>Dark mode</span></label>' +
          '<div class="hint" style="margin-top:8px">Follows your device by default.</div>' +
        '</div>' +
      '</div>' +

      (mode === 'demo' ? '<div class="card">' +
        '<div class="card-head"><div><h2>Preview data</h2>' +
        '<div class="sub">Only affects this browser</div></div></div>' +
        '<div class="card-body">' +
          '<button class="btn btn-danger" data-action="reset-demo">' + icon('rotate-ccw') +
          'Reset preview to the original figures</button></div></div>' : '');
  }

  R.cars = cars;
  R.carDetail = carDetail;
  R.mountCarDetail = mountCarDetail;
  R.payouts = payouts;
  R.capital = capital;
  R.settings = settings;
  R.filterCars = filterCars;
}(window));
