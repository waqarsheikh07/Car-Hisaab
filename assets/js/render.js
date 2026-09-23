/* =============================================================================
   render.js — every screen. Produces HTML strings and mounts charts.
   No event wiring here: app.js owns all of that through delegation.
   ============================================================================= */
(function (root) {
  'use strict';

  var C = root.Calc;
  var Art = root.Art;
  var Charts = root.Charts;

  /* ---------- helpers ----------------------------------------------------- */

  function h(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, cls) {
    return root.Icons.svg(name, cls);
  }

  // Signed money with the sign as a second channel beside the colour.
  function signed(value) {
    if (value === null || value === undefined) return '<span class="muted">—</span>';
    var cls = value > 0 ? 'pos' : (value < 0 ? 'neg' : 'muted');
    var prefix = value > 0 ? '+' : '';
    return '<span class="' + cls + ' num">' + prefix + C.formatNumber(value) + '</span>';
  }

  function money(value) {
    if (value === null || value === undefined) return '<span class="muted">—</span>';
    return '<span class="num">' + C.formatNumber(value) + '</span>';
  }

  function statusBadge(status, estimated) {
    var label = C.STATUS_LABEL[status] || status;
    var out = '<span class="badge" data-status="' + h(status) + '">' + h(label) + '</span>';
    if (estimated) {
      out += ' <span class="badge badge-est" title="Profit is the figure your partner reported, not a calculation from real purchase and sale numbers.">' +
        icon('alert-circle') + 'reported</span>';
    }
    return out;
  }

  function statusTint(status) {
    if (status === 'sold') return 'var(--good)';
    if (status === 'under_repair') return 'var(--warning)';
    if (status === 'listed') return 'var(--series-1)';
    return 'var(--accent)';
  }

  function statCard(opts) {
    return '' +
      '<div class="stat' + (opts.className ? ' ' + opts.className : '') + '">' +
        '<div class="stat-label">' + icon(opts.icon) + h(opts.label) + '</div>' +
        '<div class="stat-value' + (opts.tone ? ' ' + opts.tone : '') + '"' +
          (opts.countTo !== undefined && opts.countTo !== null
            ? ' data-count-to="' + opts.countTo + '" data-count-prefix="' + h(opts.prefix || '') + '"'
            : '') + '>' + opts.value + '</div>' +
        (opts.sub ? '<div class="stat-sub">' + opts.sub + '</div>' : '') +
        (opts.foot ? '<div class="stat-foot">' + opts.foot + '</div>' : '') +
      '</div>';
  }

  // A sold car with no sale price on record still has a profit worth showing.
  function timelineAmount(e) {
    if (e.type === 'payout' && e.amount !== null) {
      return '<span class="pos">+' + C.formatNumber(e.amount) + '</span>';
    }
    if (e.amount !== null) return C.formatNumber(e.amount);
    if (e.type === 'sold' && e.profit !== null && e.profit !== undefined) return signed(e.profit);
    return '<span class="muted">—</span>';
  }

  function emptyState(art, title, body, action) {
    return '<div class="empty">' + art +
      '<h3>' + h(title) + '</h3>' +
      '<p>' + body + '</p>' +
      (action || '') + '</div>';
  }

  function chartCard(opts) {
    return '' +
      '<div class="card chart-frame" data-chart-frame="' + h(opts.key) + '">' +
        '<div class="card-head">' +
          '<div><h2>' + h(opts.title) + '</h2>' +
            (opts.sub ? '<div class="sub">' + h(opts.sub) + '</div>' : '') + '</div>' +
          '<div class="card-head-actions">' +
            '<div class="seg" role="group" aria-label="View as">' +
              '<button type="button" data-chart-view="chart" aria-pressed="true">' + icon('bar-chart-3') + 'Chart</button>' +
              '<button type="button" data-chart-view="table" aria-pressed="false">' + icon('table-2') + 'Table</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="chart-box' + (opts.tall ? ' tall' : '') + '">' +
            '<canvas id="canvas-' + h(opts.key) + '"></canvas></div>' +
          (opts.legend || '') +
          '<div class="chart-table">' + (opts.table || '') + '</div>' +
          (opts.note ? '<div class="chart-note">' + icon('info') + opts.note + '</div>' : '') +
        '</div>' +
      '</div>';
  }

  function simpleTable(headers, rows) {
    return '<div class="table-scroll"><table><thead><tr>' +
      headers.map(function (col) {
        return '<th' + (col.right ? ' class="right"' : '') + '>' + h(col.label) + '</th>';
      }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (cell, i) {
          return '<td' + (headers[i] && headers[i].right ? ' class="right"' : '') + '>' + cell + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  /* ---------- gaps banner -------------------------------------------------- */

  function gapsBanner(summary) {
    if (!summary.dataGaps.length) return '';
    return '' +
      '<div class="banner" data-tone="warn">' + icon('alert-triangle') +
        '<div>' +
          '<div class="banner-title">Some figures are still guesses</div>' +
          '<ul>' + summary.dataGaps.map(function (g) {
            return '<li>' + h(g.message) + ' <span class="muted">(' + h(g.cars.join(', ')) + ')</span></li>';
          }).join('') + '</ul>' +
          '<div class="muted" style="margin-top:6px">Ask Usama for the missing purchase and sale prices, ' +
          'then fill them in — every total above corrects itself.</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 1. dashboard ------------------------------------------------- */

  function dashboard(state) {
    var s = state.summary;
    var months = state.months;
    var settings = state.data.settings;
    var investor = settings.investor_name || 'you';
    var partner = settings.partner_name || 'your partner';
    var split = settings.profit_split_investor === undefined ? 50 : settings.profit_split_investor;

    var gapPct = s.myProfitEarned > 0 ? (1 - s.paidRatio) : 0;
    var alarm = gapPct > 0.25 && s.outstandingToMe > 0;

    var hero = '' +
      '<div class="stat stat-hero' + (alarm ? ' is-alarm' : '') + '">' +
        '<div class="stat-label">' + icon('alert-circle') + 'Outstanding to ' + h(investor) + '</div>' +
        '<div class="stat-value" data-count-to="' + s.outstandingToMe + '" data-count-prefix="PKR ">' +
          C.formatPKR(s.outstandingToMe) + '</div>' +
        '<div class="stat-sub">' + h(C.shorthand(s.outstandingToMe) || '') +
          (C.shorthand(s.outstandingToMe) ? ' · ' : '') +
          'Profit you have earned but not received' + '</div>' +
        '<div class="progress">' +
          '<div class="progress-track">' +
            '<div class="progress-fill" data-progress="' + (s.paidRatio * 100).toFixed(2) + '"></div>' +
          '</div>' +
          '<div class="progress-legend">' +
            '<span>Earned <b>' + C.formatPKR(s.myProfitEarned) + '</b>\u00a0</span>' +
            '<span>Received <b>' + C.formatPKR(s.totalPaidToMe) + '</b>\u00a0</span>' +
            '<span>Still owed <b>' + C.formatPKR(s.outstandingToMe) + '</b></span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var stats = '<div class="stat-grid">' + hero + '</div>' +
      '<div class="stat-grid">' +
      statCard({
        icon: 'trending-up', label: 'Total profit all time',
        value: C.formatPKR(s.totalProfitAllTime), countTo: s.totalProfitAllTime, prefix: 'PKR ',
        sub: h(C.shorthand(s.totalProfitAllTime)),
        foot: icon('users') + 'Split ' + split + '/' + (100 - split) + ' with ' + h(partner)
      }) +
      statCard({
        icon: 'wallet', label: 'Your profit earned',
        value: C.formatPKR(s.myProfitEarned), countTo: s.myProfitEarned, prefix: 'PKR ',
        sub: split + '% of all profit booked',
        foot: icon('banknote') + 'Received so far ' + C.formatPKR(s.totalPaidToMe)
      }) +
      statCard({
        icon: 'car-front', label: 'Cars',
        value: '<span class="num">' + s.carsSoldCount + '</span> <span class="muted" style="font-size:17px">sold</span> · ' +
               '<span class="num">' + s.carsInStockCount + '</span> <span class="muted" style="font-size:17px">held</span>',
        sub: s.avgDaysHeld === null ? 'No completed sales yet' : 'Average hold ' + s.avgDaysHeld + ' days',
        foot: icon('trending-up') + 'Avg profit per sold car ' +
              (s.avgProfitPerCar === null ? '—' : C.formatPKR(Math.round(s.avgProfitPerCar)))
      }) +
      statCard({
        icon: 'landmark', label: 'Capital invested',
        value: C.formatPKR(s.totalCapitalInvested), countTo: s.totalCapitalInvested, prefix: 'PKR ',
        sub: h(C.shorthand(s.totalCapitalInvested)),
        foot: icon('package') + C.formatPKR(s.myCapitalDeployed) + ' of yours tied up in ' +
              s.carsInStockCount + ' unsold car' + (s.carsInStockCount === 1 ? '' : 's')
      }) +
      (s.partnerCapitalDeployed > 0 ? statCard({
        icon: 'users', label: h(partner) + '’s money in stock',
        value: C.formatPKR(s.partnerCapitalDeployed), countTo: s.partnerCapitalDeployed, prefix: 'PKR ',
        sub: 'Not yours — excluded from every figure above',
        foot: icon('info') + 'Total in stock ' + C.formatPKR(s.capitalDeployed)
      }) : '') +
      statCard({
        icon: 'piggy-bank', label: 'Capital not working',
        value: C.formatPKR(s.capitalIdle), countTo: s.capitalIdle, prefix: 'PKR ',
        sub: h(C.shorthand(s.capitalIdle)),
        foot: icon('info') + 'Invested − tied up − returned to you'
      }) +
    '</div>';

    /* monthly table — the month record system */
    var monthRows = months.map(function (m) {
      return '<tr data-clickable data-month="' + h(m.key) + '"' +
        (m.isEmpty ? ' class="is-empty-month"' : '') + '>' +
        '<td><span class="cell-title">' + h(m.label) + '</span></td>' +
        '<td class="right">' + (m.carsBought || '<span class="muted">—</span>') + '</td>' +
        '<td class="right">' + (m.carsSold || '<span class="muted">—</span>') + '</td>' +
        '<td class="right">' + money(m.saleValue || null) + '</td>' +
        '<td class="right">' + money(m.cost || null) + '</td>' +
        '<td class="right">' + signed(m.profit || null) + '</td>' +
        '<td class="right">' + money(m.myShare || null) + '</td>' +
        '<td class="right">' + money(m.paid || null) + '</td>' +
        '<td class="right"><b class="num">' + C.formatNumber(m.outstanding) + '</b></td>' +
        '</tr>';
    }).join('');

    var monthlyTable = months.length ? '' +
      '<div class="table-scroll"><table>' +
        '<thead><tr>' +
          '<th>Month</th><th class="right">Bought</th><th class="right">Sold</th>' +
          '<th class="right">Sale value</th><th class="right">Cost</th><th class="right">Profit</th>' +
          '<th class="right">Your share</th><th class="right">Paid to you</th>' +
          '<th class="right">Outstanding</th>' +
        '</tr></thead>' +
        '<tbody>' + monthRows + '</tbody>' +
        '<tfoot><tr>' +
          '<td>Total</td>' +
          '<td class="right">' + months.reduce(function (a, m) { return a + m.carsBought; }, 0) + '</td>' +
          '<td class="right">' + months.reduce(function (a, m) { return a + m.carsSold; }, 0) + '</td>' +
          '<td class="right">' + C.formatNumber(s.totalSaleValue) + '</td>' +
          '<td class="right">' + C.formatNumber(s.totalSoldCost) + '</td>' +
          '<td class="right">' + C.formatNumber(s.totalProfitAllTime) + '</td>' +
          '<td class="right">' + C.formatNumber(s.myProfitEarned) + '</td>' +
          '<td class="right">' + C.formatNumber(s.totalPaidToMe) + '</td>' +
          '<td class="right">' + C.formatNumber(s.outstandingToMe) + '</td>' +
        '</tr></tfoot>' +
      '</table></div>' :
      emptyState(Art.emptyMonth, 'No months to report yet',
        'Add a car with a purchase date and this table fills in by itself.');

    var monthlyCard = '' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div><h2>Month by month</h2>' +
          '<div class="sub">Click any month to see the cars behind it. The last column carries forward.</div></div>' +
          '<div class="card-head-actions">' +
            '<button class="btn btn-sm" data-action="export-csv">' + icon('download') + 'CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-body flush">' + monthlyTable + '</div>' +
      '</div>';

    /* charts */
    var t = Charts.theme();

    var profitChart = chartCard({
      key: 'profitByMonth',
      title: 'Profit by month',
      sub: 'Bars are the month. The line is the running total — same rupee scale.',
      legend: Charts.legendHTML([
        { label: 'Profit booked in month', color: t.series[0] },
        { label: 'Running total', color: t.series[1] }
      ]),
      table: simpleTable(
        [{ label: 'Month' }, { label: 'Profit', right: true }, { label: 'Running total', right: true }],
        months.map(function (m) {
          return [h(m.label), C.formatNumber(m.profit), C.formatNumber(m.cumulativeProfit)];
        })
      ),
      note: 'Click a bar to open that month.'
    });

    var idle = Math.max(0, s.capitalIdle);
    var splitChart = chartCard({
      key: 'moneySplit',
      title: 'Where your money is',
      sub: 'Your capital tied up in stock, sitting idle, and the profit it has booked.',
      legend: Charts.legendHTML([
        { label: 'Tied up in unsold cars', color: t.series[0], value: C.formatPKR(s.myCapitalDeployed) },
        { label: 'Idle capital', color: t.series[1], value: C.formatPKR(idle) },
        { label: 'Profit booked', color: t.series[2], value: C.formatPKR(s.totalProfitAllTime) }
      ]),
      table: simpleTable(
        [{ label: 'Bucket' }, { label: 'Amount', right: true }],
        [['Tied up in unsold cars', C.formatNumber(s.myCapitalDeployed)],
         ['Idle capital', C.formatNumber(idle)],
         ['Profit booked', C.formatNumber(s.totalProfitAllTime)]]
      )
    });

    var perCarRows = s.cars.filter(function (c) { return c.profit !== null; })
      .sort(function (a, b) { return b.profit - a.profit; });
    var perCarChart = chartCard({
      key: 'profitPerCar',
      title: 'Profit per car',
      sub: 'Which deals actually made money.',
      tall: perCarRows.length > 5,
      legend: Charts.legendHTML([
        { label: 'Profit', color: t.series[0] },
        { label: 'Loss', color: t.series[7] }
      ]),
      table: simpleTable(
        [{ label: 'Car' }, { label: 'Profit', right: true }, { label: 'Your half', right: true }, { label: 'ROI', right: true }],
        perCarRows.map(function (c) {
          return [h(c.name), C.formatNumber(c.profit), C.formatNumber(c.myShare), C.formatPercent(c.roiPercent)];
        })
      ),
      note: 'Click a bar to open that car.'
    });

    var expenseTotal = C.EXPENSE_CATEGORIES.reduce(function (a, cat) {
      return a + s.expenseTotalsByCategory[cat];
    }, 0);
    var expenseChart = expenseTotal > 0 ? chartCard({
      key: 'expenseCategories',
      title: 'Where repair money goes',
      sub: 'Every rupee spent after purchase, across the whole business.',
      legend: Charts.legendHTML(C.EXPENSE_CATEGORIES
        .map(function (cat, i) {
          return { cat: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1),
                   color: t.series[i % 8], value: s.expenseTotalsByCategory[cat] };
        })
        .filter(function (x) { return x.value > 0; })
        .map(function (x) { return { label: x.label, color: x.color, value: C.formatPKR(x.value) }; })),
      table: simpleTable(
        [{ label: 'Category' }, { label: 'Spent', right: true }],
        C.EXPENSE_CATEGORIES.filter(function (cat) { return s.expenseTotalsByCategory[cat] > 0; })
          .map(function (cat) {
            return [cat.charAt(0).toUpperCase() + cat.slice(1), C.formatNumber(s.expenseTotalsByCategory[cat])];
          })
      )
    }) : '' +
      '<div class="card"><div class="card-head"><div><h2>Where repair money goes</h2>' +
      '<div class="sub">Every rupee spent after purchase.</div></div></div>' +
      '<div class="card-body">' + emptyState(Art.emptyCapital, 'No expenses recorded yet',
        'Open a car and add what was spent on repairs, parts or paint. This chart builds itself.') +
      '</div></div>';

    /* in-stock list */
    var inStock = s.unsold.slice().sort(function (a, b) {
      return (b.daysHeld || 0) - (a.daysHeld || 0);
    });
    var stockCard = '' +
      '<div class="card">' +
        '<div class="card-head"><div><h2>Sitting in stock</h2>' +
        '<div class="sub">' + inStock.length + ' car' + (inStock.length === 1 ? '' : 's') +
        ' holding your capital right now</div></div></div>' +
        '<div class="card-body' + (inStock.length ? ' flush' : '') + '">' +
        (inStock.length ? simpleTable(
          [{ label: 'Car' }, { label: 'Bought' }, { label: 'Purchase', right: true },
           { label: 'Spent since', right: true }, { label: 'Tied up', right: true }, { label: 'Days held', right: true }],
          inStock.map(function (c) {
            return [
              '<span class="cell-title">' + h(c.name) + '</span> ' + statusBadge(c.status),
              C.formatDate(c.car.purchase_date),
              money(c.purchasePrice),
              money(c.expensesTotal || null),
              money(c.totalCost),
              c.daysHeld === null ? '<span class="muted">—</span>' : '<span class="num">' + c.daysHeld + '</span>'
            ];
          })
        ) : emptyState(Art.emptyCars, 'Nothing in stock',
              'Every car you bought has been sold. Add the next one when Usama buys it.'))
        + '</div>' +
      '</div>';

    /* timeline */
    var events = C.timeline(state.data, 14);
    var timelineCard = '' +
      '<div class="card">' +
        '<div class="card-head"><div><h2>What happened</h2>' +
        '<div class="sub">Most recent first</div></div></div>' +
        '<div class="card-body">' +
        (events.length ? '<div class="timeline">' + events.map(function (e) {
          return '<button type="button" class="tl-item" data-type="' + h(e.type) + '"' +
            (e.carId ? ' data-car="' + h(e.carId) + '"' : '') + '>' +
            '<span class="tl-icon">' + icon(e.icon) + '</span>' +
            '<span class="tl-body">' +
              '<span class="tl-top"><span class="tl-title">' + h(e.title) + '</span>' +
                '<span class="tl-amount">' + timelineAmount(e) + '</span></span>' +
              '<span class="tl-meta">' + C.formatDate(e.date) +
                (e.detail ? ' · ' + h(e.detail) : '') + '</span>' +
            '</span>' +
          '</button>';
        }).join('') + '</div>' : emptyState(Art.emptyMonth, 'Nothing recorded yet',
            'Add your first car and this feed starts filling in.')) +
        '</div>' +
      '</div>';

    return gapsBanner(s) + stats + monthlyCard + profitChart +
      '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">' +
        splitChart + expenseChart + '</div>' +
      perCarChart + stockCard + timelineCard;
  }

  function mountDashboard(state) {
    Charts.profitByMonth(document.getElementById('canvas-profitByMonth'), state.months, function (row) {
      root.App.go('cars', { month: row.key });
    });
    Charts.moneySplit(document.getElementById('canvas-moneySplit'), state.summary);
    Charts.profitPerCar(document.getElementById('canvas-profitPerCar'), state.summary.cars, function (car) {
      root.App.go('car', { id: car.id });
    });
    var expenseCanvas = document.getElementById('canvas-expenseCategories');
    if (expenseCanvas) Charts.expenseCategories(expenseCanvas, state.summary);
  }

  root.Render = {
    h: h, icon: icon, signed: signed, money: money,
    statusBadge: statusBadge, statusTint: statusTint,
    statCard: statCard, emptyState: emptyState, chartCard: chartCard, simpleTable: simpleTable,
    gapsBanner: gapsBanner,
    dashboard: dashboard, mountDashboard: mountDashboard
  };
}(window));
