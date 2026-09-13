/* =============================================================================
   app.js — routing, state, event wiring, forms, exports.
   All DOM events are handled by delegation from two listeners, so re-rendering
   a whole view never leaves a dangling handler behind.
   ============================================================================= */
(function (root) {
  'use strict';

  var C = root.Calc;
  var R = root.Render;
  var Store = root.Store;
  var Charts = root.Charts;

  var THEME_KEY = 'carhisaab.theme';
  var WELCOME_KEY = 'carhisaab.welcomed.v1';

  var state = {
    data: { cars: [], payouts: [], capital: [], settings: {} },
    summary: null,
    months: [],
    mode: 'demo',
    canWrite: false,
    today: new Date().toISOString().slice(0, 10),
    theme: 'system',
    route: { view: 'dashboard', params: {} },
    filters: { status: 'all', year: 'all', sort: 'profit', layout: 'grid', month: null },
    loading: true,
    warnings: []
  };

  var VIEWS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', title: 'Dashboard' },
    { key: 'cars', label: 'Cars', icon: 'car-front', title: 'Cars' },
    { key: 'payouts', label: 'Payouts', icon: 'banknote', title: 'Payouts' },
    { key: 'capital', label: 'Capital', icon: 'landmark', title: 'Capital' },
    { key: 'settings', label: 'Settings', icon: 'settings', title: 'Settings' }
  ];

  /* ---------- small utilities --------------------------------------------- */

  function ls(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
      return value;
    } catch (e) { return null; }
  }

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function slugify(text) {
    return String(text || 'car').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 40) || 'car';
  }

  function uniqueId(base, taken) {
    var id = base, n = 2;
    while (taken.indexOf(id) !== -1) { id = base + '-' + n; n++; }
    return id;
  }

  function nextId(prefix, list) {
    var max = 0;
    (list || []).forEach(function (item) {
      var m = String(item.id || '').match(/(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return prefix + (max + 1);
  }

  // Icons are inlined at render time, so there is nothing to hydrate.
  // Kept as a single call site in case an icon pass is ever needed again.
  function refreshIcons() {}

  /* ---------- toasts ------------------------------------------------------- */

  function toast(message, tone, sticky) {
    var host = $('#toasts');
    if (!host) return null;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('data-tone', tone || 'ok');
    el.setAttribute('role', tone === 'err' ? 'alert' : 'status');
    var iconName = tone === 'err' ? 'alert-circle' : (tone === 'busy' ? 'loader' : 'check-circle');
    el.innerHTML = root.Icons.svg(iconName) + '<div>' + R.h(message) + '</div>';
    host.appendChild(el);
    refreshIcons();
    if (!sticky) {
      window.setTimeout(function () {
        el.classList.add('is-out');
        window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      }, tone === 'err' ? 7000 : 3200);
    }
    return el;
  }

  function clearToast(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* ---------- theme -------------------------------------------------------- */

  function applyTheme(mode) {
    state.theme = mode;
    if (mode === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }
    ls(THEME_KEY, mode);
  }

  function currentThemeIsDark() {
    if (state.theme === 'dark') return true;
    if (state.theme === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ---------- count-up ----------------------------------------------------- */

  function animateNumbers(scope) {
    $$('[data-count-to]', scope).forEach(function (el) {
      var target = Number(el.getAttribute('data-count-to'));
      var prefix = el.getAttribute('data-count-prefix') || '';
      if (!isFinite(target)) return;
      if (reducedMotion()) { el.textContent = prefix + C.formatNumber(target); return; }
      var start = null, duration = 780;
      function frame(now) {
        if (start === null) start = now;
        var p = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + C.formatNumber(target * eased);
        if (p < 1) window.requestAnimationFrame(frame);
        else el.textContent = prefix + C.formatNumber(target);
      }
      window.requestAnimationFrame(frame);
    });

    $$('[data-progress]', scope).forEach(function (el) {
      var pct = Number(el.getAttribute('data-progress')) || 0;
      if (reducedMotion()) { el.style.width = pct + '%'; return; }
      window.requestAnimationFrame(function () {
        window.setTimeout(function () { el.style.width = pct + '%'; }, 60);
      });
    });
  }

  /* ---------- modal -------------------------------------------------------- */

  var modalOnSubmit = null;
  var lastFocus = null;

  function openModal(opts) {
    closeModal();
    lastFocus = document.activeElement;
    modalOnSubmit = opts.onSubmit || null;

    var host = document.createElement('div');
    host.className = 'modal-backdrop';
    host.id = 'modal';
    host.innerHTML = '' +
      '<div class="modal" role="dialog" aria-modal="true" aria-label="' + R.h(opts.title) + '">' +
        '<div class="modal-head">' +
          '<div><h2>' + R.h(opts.title) + '</h2>' +
            (opts.sub ? '<div class="sub">' + R.h(opts.sub) + '</div>' : '') + '</div>' +
          '<button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Close" ' +
            'style="margin-left:auto">' + root.Icons.svg('x') + '</button>' +
        '</div>' +
        '<form class="modal-body" data-form="modal">' + opts.body + '</form>' +
        '<div class="modal-foot">' +
          (opts.danger ? '<button class="btn btn-danger spacer" data-action="modal-danger">' +
            R.h(opts.danger) + '</button>' : '') +
          '<button class="btn" data-action="close-modal">Cancel</button>' +
          '<button class="btn btn-primary" data-action="modal-submit">' +
            R.h(opts.submitLabel || 'Save') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
    refreshIcons();

    var first = $('input:not([type=hidden]), select, textarea', host);
    if (first) first.focus();
  }

  function closeModal() {
    var el = $('#modal');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    modalOnSubmit = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } }
    lastFocus = null;
  }

  function modalValues() {
    var out = {};
    $$('#modal [data-field]').forEach(function (el) {
      out[el.getAttribute('data-field')] = el.value;
    });
    return out;
  }

  function confirmModal(title, body, danger, onYes) {
    openModal({
      title: title,
      body: '<p>' + body + '</p>',
      submitLabel: danger,
      onSubmit: function () { onYes(); return true; }
    });
    var submit = $('#modal [data-action="modal-submit"]');
    if (submit) submit.className = 'btn btn-danger';
  }

  /* ---------- form field builders for modals ------------------------------ */

  function mField(label, name, opts) {
    opts = opts || {};
    var input;
    if (opts.type === 'select') {
      input = '<select data-field="' + name + '">' + opts.options.map(function (o) {
        return '<option value="' + R.h(o[0]) + '"' + (o[0] === opts.value ? ' selected' : '') + '>' +
          R.h(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (opts.type === 'textarea') {
      input = '<textarea data-field="' + name + '" placeholder="' + R.h(opts.placeholder || '') + '">' +
        R.h(opts.value || '') + '</textarea>';
    } else {
      input = '<input type="' + (opts.type || 'text') + '" data-field="' + name + '"' +
        (opts.type === 'number' ? ' class="money" inputmode="numeric" step="1"' : '') +
        (opts.required ? ' required' : '') +
        ' value="' + R.h(opts.value === undefined || opts.value === null ? '' : opts.value) + '"' +
        ' placeholder="' + R.h(opts.placeholder || '') + '">';
    }
    return '<div class="field' + (opts.span2 ? ' span-2' : '') + '"><label>' + R.h(label) + '</label>' +
      input + (opts.hint ? '<div class="hint">' + R.h(opts.hint) + '</div>' : '') + '</div>';
  }

  /* ---------- data operations --------------------------------------------- */

  function recompute() {
    state.summary = C.businessSummary(state.data, state.today);
    state.months = C.monthlyReport(state.data, state.today);
  }

  async function persist(file, value, message) {
    var busy = toast('Saving…', 'busy', true);
    try {
      await Store.save(file, value, message);
      clearToast(busy);
      toast(Store.mode === 'demo' ? 'Saved in this browser' : 'Saved to GitHub', 'ok');
      recompute();
      render();
      return true;
    } catch (err) {
      clearToast(busy);
      toast('Not saved: ' + err.message, 'err');
      return false;
    }
  }

  function carById(id) {
    return state.data.cars.filter(function (c) { return c.id === id; })[0];
  }

  /* ---------- routing ------------------------------------------------------ */

  function go(view, params) {
    state.route = { view: view, params: params || {} };
    if (view === 'cars' && params && params.month) state.filters.month = params.month;
    if (view !== 'cars') { /* month filter is remembered while browsing cars */ }
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    render();
  }

  function currentTitle() {
    if (state.route.view === 'car') {
      var car = carById(state.route.params.id);
      return car ? car.name : 'Car';
    }
    var v = VIEWS.filter(function (x) { return x.key === state.route.view; })[0];
    return v ? v.title : 'Dashboard';
  }

  function currentSubtitle() {
    var s = state.summary;
    if (!s) return '';
    if (state.route.view === 'dashboard') {
      return C.formatPKR(s.outstandingToMe) + ' still owed to you · ' +
        s.carsInStockCount + ' cars in stock';
    }
    if (state.route.view === 'cars') {
      var shown = R.filterCars(state).length;
      return shown + ' of ' + s.cars.length + ' cars' +
        (state.filters.month ? ' · ' + C.monthLabel(state.filters.month) : '');
    }
    if (state.route.view === 'payouts') return C.formatPKR(s.totalPaidToMe) + ' received to date';
    if (state.route.view === 'capital') return C.formatPKR(s.totalCapitalInvested) + ' invested';
    if (state.route.view === 'car') {
      var car = carById(state.route.params.id);
      if (!car) return '';
      var cs = C.carSummary(car, state.data.settings, state.today);
      return cs.isSold
        ? 'Sold ' + C.formatDate(car.sale_date) + ' · profit ' + C.formatPKR(cs.profit)
        : 'Bought ' + C.formatDate(car.purchase_date) +
          (cs.daysHeld === null ? '' : ' · held ' + cs.daysHeld + ' days');
    }
    return '';
  }

  /* ---------- render ------------------------------------------------------- */

  function modeChip() {
    var label = { live: 'GitHub', readonly: 'Read-only', demo: 'Preview' }[state.mode];
    return '<div class="conn" data-state="' + state.mode + '" title="' +
      (state.mode === 'live' ? 'Connected to GitHub' :
       state.mode === 'demo' ? 'Sample data, saved in this browser only' :
       'Reading the repo files, no token connected') + '">' +
      '<span class="conn-dot"></span><span>' + label + '</span></div>';
  }

  function skeleton() {
    return '<div class="stat-grid">' +
        '<div class="skeleton sk-hero"></div>' +
        '<div class="skeleton sk-stat"></div><div class="skeleton sk-stat"></div>' +
        '<div class="skeleton sk-stat"></div><div class="skeleton sk-stat"></div>' +
      '</div>' +
      '<div class="skeleton sk-card"></div>' +
      '<div class="skeleton sk-card"></div>';
  }

  function render() {
    var navHTML = VIEWS.map(function (v) {
      var count = v.key === 'cars' ? state.data.cars.length
        : v.key === 'payouts' ? state.data.payouts.length
        : v.key === 'capital' ? state.data.capital.length : null;
      var active = state.route.view === v.key || (state.route.view === 'car' && v.key === 'cars');
      return '<button type="button" class="nav-item" data-go="' + v.key + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        root.Icons.svg(v.icon) + '<span>' + v.label + '</span>' +
        (count ? '<span class="nav-count">' + count + '</span>' : '') + '</button>';
    }).join('');

    var tabHTML = VIEWS.map(function (v) {
      var active = state.route.view === v.key || (state.route.view === 'car' && v.key === 'cars');
      return '<button type="button" data-go="' + v.key + '"' + (active ? ' aria-current="page"' : '') + '>' +
        root.Icons.svg(v.icon) + '<span>' + v.label + '</span></button>';
    }).join('');

    var sidebar = $('#sidebar-nav');
    if (sidebar) sidebar.innerHTML = navHTML;
    var tabs = $('#tabbar');
    if (tabs) tabs.innerHTML = tabHTML;
    var conn = $('#conn-slot');
    if (conn) conn.innerHTML = modeChip();

    $('#page-title').textContent = currentTitle();
    $('#page-sub').textContent = currentSubtitle();

    var addAction = { cars: 'add-car', payouts: 'add-payout', capital: 'add-capital' }[state.route.view];
    $('#topbar-add').innerHTML = addAction && state.canWrite
      ? '<button class="btn btn-primary btn-sm" data-action="' + addAction + '">' +
        root.Icons.svg('plus') + '<span class="nowrap">Add</span></button>'
      : '';

    var view = $('#view');

    if (state.loading) {
      view.innerHTML = skeleton();
      refreshIcons();
      return;
    }

    Charts.destroyAll();

    var html = '';
    if (state.warnings.length) {
      html += state.warnings.map(function (w) {
        return '<div class="banner" data-tone="warn">' + root.Icons.svg('alert-triangle') + '<div>' +
          R.h(w) + '</div></div>';
      }).join('');
    }

    switch (state.route.view) {
      case 'cars':     html += R.cars(state); break;
      case 'car':      html += R.carDetail(state, state.route.params.id); break;
      case 'payouts':  html += R.payouts(state); break;
      case 'capital':  html += R.capital(state); break;
      case 'settings': html += R.settings(state); break;
      default:         html += R.dashboard(state);
    }

    view.innerHTML = html;
    refreshIcons();
    animateNumbers(view);

    if (!root.Chart) {
      $$('.chart-frame').forEach(function (frame) {
        frame.classList.add('show-table');
        $$('[data-chart-view]', frame).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-chart-view') === 'table'));
          b.disabled = true;
        });
        var note = frame.querySelector('.chart-note');
        if (note) {
          note.innerHTML = root.Icons.svg('alert-triangle') +
            'Charts could not load (the chart library was blocked). Figures are shown as a table.';
        }
      });
      return;
    }

    if (state.route.view === 'dashboard') R.mountDashboard(state);
    if (state.route.view === 'car') R.mountCarDetail(state, state.route.params.id);
  }

  /* ---------- exports ------------------------------------------------------ */

  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Downloaded ' + filename, 'ok');
    } catch (e) {
      showText(filename, text);
    }
  }

  // Some contexts (the shared preview link) block downloads entirely — show the
  // content so it can always be copied out.
  function showText(filename, text) {
    openModal({
      title: filename,
      sub: 'Downloads are blocked here — select all and copy',
      body: '<textarea readonly style="min-height:320px;font-family:var(--mono);font-size:12px">' +
        R.h(text) + '</textarea>',
      submitLabel: 'Copy',
      onSubmit: function () {
        var ta = $('#modal textarea');
        if (ta) {
          ta.select();
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () { toast('Copied', 'ok'); });
          } else {
            try { document.execCommand('copy'); toast('Copied', 'ok'); } catch (e) { /* manual copy */ }
          }
        }
        return false;
      }
    });
  }

  function exportJSON() {
    var payload = {
      exported_at: new Date().toISOString(),
      cars: state.data.cars, payouts: state.data.payouts,
      capital: state.data.capital, settings: state.data.settings
    };
    var text = JSON.stringify(payload, null, 2);
    if (state.mode === 'demo') showText('car-hisaab-backup.json', text);
    else download('car-hisaab-backup.json', text, 'application/json');
  }

  function exportMonthlyCSV() {
    var text = C.toCSV(state.months, [
      { label: 'Month', value: function (m) { return m.label; } },
      { label: 'Cars bought', value: function (m) { return m.carsBought; } },
      { label: 'Cars sold', value: function (m) { return m.carsSold; } },
      { label: 'Sale value PKR', value: function (m) { return m.saleValue; } },
      { label: 'Cost PKR', value: function (m) { return m.cost; } },
      { label: 'Repairs PKR', value: function (m) { return m.spendOnRepairs; } },
      { label: 'Capital in PKR', value: function (m) { return m.capitalIn; } },
      { label: 'Profit PKR', value: function (m) { return m.profit; } },
      { label: 'Your share PKR', value: function (m) { return m.myShare; } },
      { label: 'Paid to you PKR', value: function (m) { return m.paid; } },
      { label: 'Outstanding PKR', value: function (m) { return m.outstanding; } }
    ]);
    if (state.mode === 'demo') showText('monthly-report.csv', text);
    else download('monthly-report.csv', text, 'text/csv;charset=utf-8');
  }

  function exportCarsCSV() {
    var text = C.toCSV(state.summary.cars, [
      { label: 'Car', value: function (c) { return c.name; } },
      { label: 'Year', value: function (c) { return c.model_year; } },
      { label: 'Status', value: function (c) { return c.statusLabel; } },
      { label: 'Purchase date', value: function (c) { return c.car.purchase_date; } },
      { label: 'Purchase price PKR', value: function (c) { return c.purchasePrice; } },
      { label: 'Expenses PKR', value: function (c) { return c.expensesTotal; } },
      { label: 'Total cost PKR', value: function (c) { return c.totalCost; } },
      { label: 'Sale date', value: function (c) { return c.car.sale_date; } },
      { label: 'Sale price PKR', value: function (c) { return c.salePrice; } },
      { label: 'Profit PKR', value: function (c) { return c.profit; } },
      { label: 'Your share PKR', value: function (c) { return c.myShare; } },
      { label: 'ROI %', value: function (c) { return c.roiPercent === null ? '' : c.roiPercent.toFixed(2); } },
      { label: 'Days held', value: function (c) { return c.daysHeld; } },
      { label: 'Profit is reported figure', value: function (c) { return c.profitEstimated ? 'yes' : 'no'; } }
    ]);
    if (state.mode === 'demo') showText('cars.csv', text);
    else download('cars.csv', text, 'text/csv;charset=utf-8');
  }

  /* ---------- modals: add / edit ------------------------------------------- */

  function addCarModal() {
    openModal({
      title: 'Add a car',
      sub: 'Only the name is required — fill in the rest as you learn it',
      body: '<div class="form-grid">' +
        mField('Car name', 'name', { required: true, placeholder: 'e.g. Yaris' }) +
        mField('Model year', 'model_year', { type: 'number', placeholder: '2022' }) +
        mField('Purchase date', 'purchase_date', { type: 'date', value: state.today }) +
        mField('Purchase price (PKR)', 'purchase_price', { type: 'number', placeholder: '3000000' }) +
        mField('Status', 'status', {
          type: 'select', value: 'in_stock',
          options: C.STATUSES.map(function (s) { return [s, C.STATUS_LABEL[s]]; })
        }) +
        mField('Registration', 'registration', { placeholder: 'optional' }) +
        mField('Photo URL', 'image_url', { span2: true, placeholder: 'https://… (optional)' }) +
        mField('Notes', 'notes', { type: 'textarea', span2: true, placeholder: 'optional' }) +
      '</div>',
      submitLabel: 'Add car',
      onSubmit: function () {
        var v = modalValues();
        if (!v.name || !v.name.trim()) { toast('Give the car a name', 'err'); return false; }
        var taken = state.data.cars.map(function (c) { return c.id; });
        var base = slugify(v.name) + (v.model_year ? '-' + v.model_year : '');
        var car = {
          id: uniqueId(base, taken),
          name: v.name.trim(),
          model_year: C.num(v.model_year),
          registration: v.registration || '',
          image_url: v.image_url || '',
          purchase_date: v.purchase_date || null,
          purchase_price: C.num(v.purchase_price),
          status: v.status || 'in_stock',
          sale_date: null, sale_price: null, profit_override: null,
          buyer_note: '', needs_confirmation: false,
          expenses: [],
          notes: v.notes || ''
        };
        state.data.cars.push(car);
        persist('cars', state.data.cars, 'Add ' + car.name).then(function (ok) {
          if (ok) go('car', { id: car.id });
        });
        return true;
      }
    });
  }

  function addExpenseModal(carId) {
    var car = carById(carId);
    if (!car) return;
    openModal({
      title: 'Add expense to ' + car.name,
      body: '<div class="form-grid">' +
        mField('Date', 'date', { type: 'date', value: state.today }) +
        mField('Category', 'category', {
          type: 'select', value: 'repair',
          options: C.EXPENSE_CATEGORIES.map(function (c) {
            return [c, c.charAt(0).toUpperCase() + c.slice(1)];
          })
        }) +
        mField('Amount (PKR)', 'amount', { type: 'number', required: true, placeholder: '20000' }) +
        mField('Note', 'note', { placeholder: 'e.g. suspension work' }) +
      '</div>',
      submitLabel: 'Add expense',
      onSubmit: function () {
        var v = modalValues();
        var amount = C.num(v.amount);
        if (amount === null) { toast('Enter the amount', 'err'); return false; }
        car.expenses = car.expenses || [];
        car.expenses.push({
          id: nextId('e', car.expenses),
          date: v.date || state.today,
          category: v.category || 'other',
          amount: amount,
          note: v.note || ''
        });
        persist('cars', state.data.cars, 'Add ' + v.category + ' expense to ' + car.name);
        return true;
      }
    });
  }

  function markSoldModal(carId) {
    var car = carById(carId);
    if (!car) return;
    var cost = C.totalCost(car);
    openModal({
      title: 'Mark ' + car.name + ' as sold',
      sub: cost === null ? 'No purchase price on record yet — profit cannot be calculated'
                         : 'Total cost so far is ' + C.formatPKR(cost),
      body: '<div class="form-grid">' +
        mField('Sale date', 'sale_date', { type: 'date', value: state.today }) +
        mField('Sale price (PKR)', 'sale_price', { type: 'number', required: true, placeholder: '3200000' }) +
        mField('Buyer note', 'buyer_note', { span2: true, placeholder: 'optional' }) +
      '</div>',
      submitLabel: 'Mark as sold',
      onSubmit: function () {
        var v = modalValues();
        var price = C.num(v.sale_price);
        if (price === null) { toast('Enter the sale price', 'err'); return false; }
        car.status = 'sold';
        car.sale_date = v.sale_date || state.today;
        car.sale_price = price;
        if (v.buyer_note) car.buyer_note = v.buyer_note;
        persist('cars', state.data.cars, 'Mark ' + car.name + ' as sold');
        return true;
      }
    });
  }

  function addPayoutModal() {
    var outstanding = state.summary.outstandingToMe;
    openModal({
      title: 'Record a payment',
      sub: outstanding > 0 ? C.formatPKR(outstanding) + ' is currently owed to you' : '',
      body: '<div class="form-grid">' +
        mField('Date', 'date', { type: 'date', value: state.today }) +
        mField('Amount (PKR)', 'amount', { type: 'number', required: true, placeholder: '70000' }) +
        mField('Method', 'method', {
          type: 'select', value: 'bank',
          options: [['bank', 'Bank transfer'], ['cash', 'Cash'], ['easypaisa', 'Easypaisa'],
                    ['jazzcash', 'JazzCash'], ['cheque', 'Cheque'], ['other', 'Other']]
        }) +
        mField('For which car', 'car_id', {
          type: 'select', value: '',
          options: [['', 'Lump sum / not car-specific']].concat(
            state.data.cars.map(function (c) { return [c.id, c.name]; }))
        }) +
        mField('Note', 'note', { span2: true, placeholder: 'e.g. profit share for Swift' }) +
      '</div>',
      submitLabel: 'Record payment',
      onSubmit: function () {
        var v = modalValues();
        var amount = C.num(v.amount);
        if (amount === null) { toast('Enter the amount', 'err'); return false; }
        state.data.payouts.push({
          id: nextId('p', state.data.payouts),
          date: v.date || state.today,
          amount: amount,
          method: v.method || 'bank',
          note: v.note || '',
          car_id: v.car_id || null
        });
        persist('payouts', state.data.payouts, 'Record payment of ' + C.formatPKR(amount));
        return true;
      }
    });
  }

  function addCapitalModal() {
    openModal({
      title: 'Add capital',
      sub: 'Money you transferred into the business',
      body: '<div class="form-grid">' +
        mField('Date', 'date', { type: 'date', value: state.today }) +
        mField('Amount (PKR)', 'amount', { type: 'number', required: true, placeholder: '500000' }) +
        mField('Note', 'note', { span2: true, placeholder: 'e.g. token amount' }) +
      '</div>',
      submitLabel: 'Add capital',
      onSubmit: function () {
        var v = modalValues();
        var amount = C.num(v.amount);
        if (amount === null) { toast('Enter the amount', 'err'); return false; }
        state.data.capital.push({
          id: nextId('c', state.data.capital),
          date: v.date || state.today,
          amount: amount,
          note: v.note || ''
        });
        persist('capital', state.data.capital, 'Add capital ' + C.formatPKR(amount));
        return true;
      }
    });
  }

  function welcomeModal() {
    var connected = Store.isConnected();
    openModal({
      title: 'Welcome to Car Hisaab',
      sub: connected ? '' : 'Two ways to use this',
      body: '' +
        '<p>This tracks every car in the business: what it cost, what was spent fixing it, ' +
        'what it sold for, and — the part that matters — <b>how much of your profit share has ' +
        'actually reached you</b>.</p>' +
        '<div class="banner" data-tone="info">' + root.Icons.svg('eye') + '<div>' +
          '<div class="banner-title">Looking around</div>' +
          'It is loaded with the figures Usama shared. Add, edit and delete freely — ' +
          'nothing leaves this browser until you connect a token.</div></div>' +
        '<div class="banner" data-tone="warn">' + root.Icons.svg('github') + '<div>' +
          '<div class="banner-title">Using it for real</div>' +
          'Connect a GitHub token in Settings. Every change then commits straight to ' +
          'your repo, so the data is yours and versioned.</div></div>',
      submitLabel: 'Start looking around',
      danger: null,
      onSubmit: function () { ls(WELCOME_KEY, '1'); return true; }
    });
    var cancel = $('#modal [data-action="close-modal"].btn:not(.btn-ghost)');
    if (cancel) {
      cancel.textContent = 'Open Settings';
      cancel.setAttribute('data-action', 'welcome-settings');
    }
  }

  /* ---------- form readers ------------------------------------------------- */

  function readForm(selector) {
    var out = {};
    $$(selector + ' [data-field]').forEach(function (el) {
      out[el.getAttribute('data-field')] = el.value;
    });
    return out;
  }

  function saveCar() {
    var car = carById(state.route.params.id);
    if (!car) return;
    var v = readForm('[data-form="car"]');
    car.name = (v.name || '').trim() || car.name;
    car.model_year = C.num(v.model_year);
    car.status = v.status || car.status;
    car.registration = v.registration || '';
    car.purchase_date = v.purchase_date || null;
    car.purchase_price = C.num(v.purchase_price);
    car.sale_date = v.sale_date || null;
    car.sale_price = C.num(v.sale_price);
    car.image_url = v.image_url || '';
    car.buyer_note = v.buyer_note || '';
    car.notes = v.notes || '';
    if (car.purchase_date && car.sale_date && car.sale_date < car.purchase_date) {
      toast('Sale date is before the purchase date — check it', 'err');
      return;
    }
    // Real numbers beat a reported figure: drop the override once both exist.
    if (car.purchase_price !== null && car.sale_price !== null) car.profit_override = null;
    if (car.sale_price !== null && car.status !== 'sold') car.status = 'sold';
    persist('cars', state.data.cars, 'Update ' + car.name);
  }

  function saveSettings() {
    var v = readForm('[data-form="settings"]');
    var mine = C.num(v.profit_split_investor);
    var theirs = C.num(v.profit_split_partner);
    if (mine === null || mine < 0 || mine > 100) { toast('Your share must be 0–100', 'err'); return; }
    if (theirs === null) theirs = 100 - mine;
    if (Math.round(mine + theirs) !== 100) {
      toast('The two shares must add up to 100 (currently ' + (mine + theirs) + ')', 'err');
      return;
    }
    state.data.settings = Object.assign({}, state.data.settings, {
      investor_name: v.investor_name || 'Waqar',
      partner_name: v.partner_name || 'Usama',
      profit_split_investor: mine,
      profit_split_partner: theirs
    });
    persist('settings', state.data.settings, 'Update profit split');
  }

  async function testConnection() {
    var v = readForm('[data-form="connection"]');
    if (!v.owner || !v.repo) { toast('Enter the username and repository', 'err'); return; }
    if (!v.token) { toast('Paste a personal access token', 'err'); return; }
    var busy = toast('Checking…', 'busy', true);
    try {
      var result = await Store.testConnection(v);
      clearToast(busy);
      toast('Connected to ' + result.repo + (result.private ? ' (private)' : ''), 'ok');
      await boot({ keepView: true });
    } catch (err) {
      clearToast(busy);
      toast(err.message, 'err');
    }
  }

  /* ---------- event delegation -------------------------------------------- */

  var ACTIONS = {
    'add-car': addCarModal,
    'add-payout': addPayoutModal,
    'add-capital': addCapitalModal,
    'add-expense': function () { addExpenseModal(state.route.params.id); },
    'mark-sold': function () { markSoldModal(state.route.params.id); },
    'save-car': saveCar,
    'save-settings': saveSettings,
    'test-connection': testConnection,
    'reload-data': function () { boot({ keepView: true }); },
    'export-json': exportJSON,
    'export-csv': exportMonthlyCSV,
    'export-cars-csv': exportCarsCSV,
    'go-cars': function () { go('cars'); },
    'go-settings': function () { go('settings'); },
    'welcome-settings': function () { ls(WELCOME_KEY, '1'); closeModal(); go('settings'); },
    'close-modal': closeModal,
    'clear-month': function () { state.filters.month = null; render(); },
    'clear-filters': function () {
      state.filters = { status: 'all', year: 'all', sort: 'profit', layout: state.filters.layout, month: null };
      render();
    },
    'toggle-theme': function (el) {
      applyTheme(el.checked ? 'dark' : 'light');
      render();
    },
    'disconnect': function () {
      confirmModal('Disconnect token?',
        'The token is removed from this browser. Your data stays in the repo.',
        'Disconnect', function () { Store.disconnect(); boot({ keepView: true }); });
    },
    'reset-demo': function () {
      confirmModal('Reset preview data?',
        'Everything goes back to the original figures. This only affects this browser.',
        'Reset', function () { Store.resetDemo(); boot({ keepView: true }); });
    },
    'delete-car': function () {
      var car = carById(state.route.params.id);
      if (!car) return;
      confirmModal('Delete ' + car.name + '?',
        'This removes the car and everything spent on it. It cannot be undone.',
        'Delete', function () {
          state.data.cars = state.data.cars.filter(function (c) { return c.id !== car.id; });
          state.route = { view: 'cars', params: {} };
          persist('cars', state.data.cars, 'Delete ' + car.name);
        });
    },
    'delete-expense': function (el) {
      var car = carById(state.route.params.id);
      var expenseId = el.getAttribute('data-expense');
      if (!car) return;
      car.expenses = (car.expenses || []).filter(function (e) { return e.id !== expenseId; });
      persist('cars', state.data.cars, 'Remove expense from ' + car.name);
    },
    'delete-payout': function (el) {
      var id = el.getAttribute('data-payout');
      var row = state.data.payouts.filter(function (p) { return p.id === id; })[0];
      confirmModal('Delete this payment?',
        'Removing ' + C.formatPKR(row && row.amount) + ' will increase the outstanding balance.',
        'Delete', function () {
          state.data.payouts = state.data.payouts.filter(function (p) { return p.id !== id; });
          persist('payouts', state.data.payouts, 'Delete payment');
        });
    },
    'delete-capital': function (el) {
      var id = el.getAttribute('data-capital');
      confirmModal('Delete this capital entry?', 'Your total invested figure will drop.',
        'Delete', function () {
          state.data.capital = state.data.capital.filter(function (c) { return c.id !== id; });
          persist('capital', state.data.capital, 'Delete capital entry');
        });
    },
    'modal-submit': function () {
      if (!modalOnSubmit) { closeModal(); return; }
      var shouldClose = modalOnSubmit();
      if (shouldClose !== false) closeModal();
    },
    'modal-danger': closeModal
  };

  function onClick(event) {
    var target = event.target;

    var actionEl = target.closest('[data-action]');
    if (actionEl) {
      var name = actionEl.getAttribute('data-action');
      if (ACTIONS[name]) {
        if (actionEl.tagName !== 'INPUT') event.preventDefault();
        ACTIONS[name](actionEl);
        return;
      }
    }

    var backdrop = target.closest('.modal-backdrop');
    if (backdrop && target === backdrop) { closeModal(); return; }

    var goEl = target.closest('[data-go]');
    if (goEl) { go(goEl.getAttribute('data-go')); return; }

    var carEl = target.closest('[data-car]');
    if (carEl) { go('car', { id: carEl.getAttribute('data-car') }); return; }

    var monthEl = target.closest('[data-month]');
    if (monthEl) { go('cars', { month: monthEl.getAttribute('data-month') }); return; }

    var statusEl = target.closest('[data-filter-status]');
    if (statusEl) {
      state.filters.status = statusEl.getAttribute('data-filter-status');
      render();
      return;
    }

    var layoutEl = target.closest('[data-layout]');
    if (layoutEl) {
      state.filters.layout = layoutEl.getAttribute('data-layout');
      render();
      return;
    }

    var chartViewEl = target.closest('[data-chart-view]');
    if (chartViewEl) {
      var frame = chartViewEl.closest('.chart-frame');
      var wantTable = chartViewEl.getAttribute('data-chart-view') === 'table';
      frame.classList.toggle('show-table', wantTable);
      $$('[data-chart-view]', frame).forEach(function (b) {
        b.setAttribute('aria-pressed', String((b.getAttribute('data-chart-view') === 'table') === wantTable));
      });
      return;
    }
  }

  function onChange(event) {
    var el = event.target;
    if (el.matches('[data-filter-year]')) { state.filters.year = el.value; render(); return; }
    if (el.matches('[data-filter-sort]')) { state.filters.sort = el.value; render(); return; }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && $('#modal')) { closeModal(); return; }
    if (event.key === 'Enter' && $('#modal') && event.target.matches('input')) {
      event.preventDefault();
      ACTIONS['modal-submit']();
    }
  }

  /* ---------- boot --------------------------------------------------------- */

  async function boot(opts) {
    opts = opts || {};
    state.loading = true;
    if (!opts.keepView) render();

    var result = await Store.load();
    state.data = result.data;
    state.mode = result.mode;
    state.warnings = result.warnings || [];
    state.canWrite = Store.canWrite();
    state.today = new Date().toISOString().slice(0, 10);
    recompute();
    state.loading = false;
    render();

    if (!opts.keepView && !ls(WELCOME_KEY) && state.mode === 'demo') {
      window.setTimeout(welcomeModal, 500);
    }
  }

  function init() {
    var saved = ls(THEME_KEY);
    applyTheme(saved === 'dark' || saved === 'light' ? saved : 'system');

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (state.theme === 'system' && !state.loading) render();
      });
    }

    Store.on(function (type, detail) {
      if (type === 'error' && detail.message) { /* surfaced by persist() */ }
    });

    boot();
  }

  root.App = { go: go, boot: boot, state: state, toast: toast };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
