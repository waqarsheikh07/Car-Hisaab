/* =============================================================================
   charts.js — every Chart.js instance lives here.

   Rules this file holds to:
   · One y-axis per chart, always. Monthly profit and cumulative profit are both
     PKR, so they share a single scale — never a second axis.
   · Colour is the validated categorical palette; profit/loss polarity uses the
     blue<->red diverging pair, not green/red (green/red is the pair colourblind
     readers cannot separate). Sign is also carried by direction and by the
     printed value, so colour is never the only channel.
   · Every chart has a hover tooltip with the exact rupee figure, and a table
     view behind a toggle for anyone who cannot read the colours at all.
   ============================================================================= */
(function (root) {
  'use strict';

  var C = root.Calc;
  var instances = {};

  /* ---------- theme ------------------------------------------------------- */

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    return {
      series: [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return token('--series-' + n); }),
      surface: token('--surface'),
      sunken: token('--surface-sunken'),
      ink: token('--ink'),
      ink2: token('--ink-2'),
      ink3: token('--ink-3'),
      grid: token('--grid'),
      axis: token('--axis'),
      accent: token('--accent'),
      good: token('--good'),
      line: token('--line')
    };
  }

  function fontStack() {
    return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }

  /* ---------- shared options ---------------------------------------------- */

  function tooltipConfig(t, formatter) {
    return {
      enabled: true,
      backgroundColor: t.ink,
      titleColor: t.surface,
      bodyColor: t.surface,
      borderColor: 'transparent',
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
      boxWidth: 9,
      boxHeight: 9,
      boxPadding: 5,
      usePointStyle: true,
      titleFont: { family: fontStack(), size: 12, weight: '600' },
      bodyFont: { family: fontStack(), size: 12.5 },
      callbacks: formatter || {}
    };
  }

  function moneyAxis(t, opts) {
    return Object.assign({
      grid: { color: t.grid, drawTicks: false, lineWidth: 1 },
      border: { display: false },
      ticks: {
        color: t.ink3,
        font: { family: fontStack(), size: 11 },
        padding: 8,
        callback: function (value) { return compact(value); }
      }
    }, opts || {});
  }

  function categoryAxis(t, opts) {
    return Object.assign({
      grid: { display: false },
      border: { color: t.axis },
      ticks: { color: t.ink3, font: { family: fontStack(), size: 11 }, padding: 6 }
    }, opts || {});
  }

  // Axis ticks stay short so they never collide; tooltips carry the exact figure.
  function compact(value) {
    var n = Number(value);
    if (!isFinite(n)) return '';
    var abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return sign + trimZeros(abs / 10000000) + 'cr';
    if (abs >= 100000) return sign + trimZeros(abs / 100000) + 'L';
    if (abs >= 1000) return sign + trimZeros(abs / 1000) + 'k';
    return sign + abs;
  }
  function trimZeros(x) { return String(Number(x.toFixed(x < 10 ? 1 : 0))); }

  function destroy(key) {
    if (instances[key]) { instances[key].destroy(); delete instances[key]; }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  function make(key, canvas, config) {
    destroy(key);
    if (!canvas || !root.Chart) return null;
    instances[key] = new root.Chart(canvas.getContext('2d'), config);
    return instances[key];
  }

  /* ---------- direct-label plugin ----------------------------------------- */
  /* Values printed on the marks themselves, in text ink — never in the series
     colour. This is what makes the light-mode palette legal (three of its hues
     sit under 3:1 against the surface, so a visible label is required). */

  var directLabels = {
    id: 'directLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.enabled) return;
      var ctx = chart.ctx;
      var t = opts.theme;
      ctx.save();
      ctx.font = '600 11px ' + fontStack();
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach(function (dataset, di) {
        if (dataset.hideLabels) return;
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach(function (element, i) {
          var raw = dataset.data[i];
          if (raw === null || raw === undefined || raw === 0) return;
          var text = opts.format ? opts.format(raw, i, di) : compact(raw);
          if (!text) return;
          var pos = element.tooltipPosition();
          var x = pos.x, y = pos.y;
          if (opts.axis === 'y') {
            ctx.textAlign = raw >= 0 ? 'left' : 'right';
            x = raw >= 0 ? element.x + 7 : element.x - 7;
            y = element.y;
          } else {
            ctx.textAlign = 'center';
            y = raw >= 0 ? element.y - 11 : element.y + 11;
          }
          ctx.fillStyle = t.ink2;
          ctx.fillText(text, x, y);
        });
      });
      ctx.restore();
    }
  };

  function ensurePlugin() {
    if (!root.Chart) return;
    if (!ensurePlugin.done) { root.Chart.register(directLabels); ensurePlugin.done = true; }
  }

  /* ---------- 1. profit by month ------------------------------------------ */

  function profitByMonth(canvas, months, onPick) {
    ensurePlugin();
    var t = theme();
    var rows = months || [];
    var labels = rows.map(function (m) { return m.label.replace(' 20', " '"); });

    return make('profitByMonth', canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Profit booked',
            data: rows.map(function (m) { return m.profit; }),
            backgroundColor: t.series[0],
            hoverBackgroundColor: t.series[0],
            borderRadius: 4,
            borderSkipped: 'bottom',
            borderColor: t.surface,
            borderWidth: { top: 0, right: 1, bottom: 0, left: 1 },
            maxBarThickness: 40,
            order: 2
          },
          {
            type: 'line',
            label: 'Running total',
            data: rows.map(function (m) { return m.cumulativeProfit; }),
            borderColor: t.series[1],
            backgroundColor: t.series[1],
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: t.series[1],
            pointBorderColor: t.surface,
            pointBorderWidth: 2,
            tension: 0.3,
            fill: false,
            hideLabels: true,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        onClick: function (evt, els) {
          if (!onPick || !els.length) return;
          var row = rows[els[0].index];
          if (row) onPick(row);
        },
        onHover: function (evt, els) {
          evt.native.target.style.cursor = els.length && onPick ? 'pointer' : 'default';
        },
        scales: {
          x: categoryAxis(t),
          y: moneyAxis(t, { beginAtZero: true })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltipConfig(t, {
            title: function (items) { return rows[items[0].dataIndex].label; },
            label: function (item) {
              return '  ' + item.dataset.label + ': ' + C.formatPKR(item.raw);
            },
            afterBody: function (items) {
              var row = rows[items[0].dataIndex];
              var out = [];
              if (row.carsSold) out.push('Sold: ' + row.carsSoldNames.join(', '));
              if (row.carsBought) out.push('Bought: ' + row.carsBoughtNames.join(', '));
              if (row.paid) out.push('Paid to you: ' + C.formatPKR(row.paid));
              return out.length ? [''].concat(out) : [];
            }
          }),
          directLabels: { enabled: false, theme: t }
        }
      }
    });
  }

  /* ---------- 2. money split donut ---------------------------------------- */

  function moneySplit(canvas, summary) {
    ensurePlugin();
    var t = theme();
    var idle = Math.max(0, summary.capitalIdle);
    var slices = [
      { label: 'Tied up in unsold cars', value: Math.max(0, summary.myCapitalDeployed), color: t.series[0] },
      { label: 'Idle capital', value: idle, color: t.series[1] },
      { label: 'Profit booked', value: Math.max(0, summary.totalProfitAllTime), color: t.series[2] }
    ].filter(function (s) { return s.value > 0; });

    return make('moneySplit', canvas, {
      type: 'doughnut',
      data: {
        labels: slices.map(function (s) { return s.label; }),
        datasets: [{
          data: slices.map(function (s) { return s.value; }),
          backgroundColor: slices.map(function (s) { return s.color; }),
          borderColor: t.surface,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: tooltipConfig(t, {
            label: function (item) {
              var total = item.dataset.data.reduce(function (a, b) { return a + b; }, 0);
              var pct = total ? (item.raw / total * 100).toFixed(1) : '0';
              return '  ' + item.label + ': ' + C.formatPKR(item.raw) + '  (' + pct + '%)';
            }
          }),
          directLabels: { enabled: false, theme: t }
        }
      }
    });
  }

  /* ---------- 3. profit per car ------------------------------------------- */

  function profitPerCar(canvas, cars, onPick) {
    ensurePlugin();
    var t = theme();
    var rows = (cars || [])
      .filter(function (c) { return c.profit !== null; })
      .sort(function (a, b) { return b.profit - a.profit; });

    return make('profitPerCar', canvas, {
      type: 'bar',
      data: {
        labels: rows.map(function (c) { return c.name; }),
        datasets: [{
          label: 'Profit',
          data: rows.map(function (c) { return c.profit; }),
          backgroundColor: rows.map(function (c) { return c.profit >= 0 ? t.series[0] : t.series[7]; }),
          borderRadius: 4,
          borderSkipped: false,
          borderColor: t.surface,
          borderWidth: { top: 1, bottom: 1, left: 0, right: 0 },
          maxBarThickness: 26
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        layout: { padding: { right: 52 } },
        onClick: function (evt, els) {
          if (!onPick || !els.length) return;
          onPick(rows[els[0].index]);
        },
        onHover: function (evt, els) {
          evt.native.target.style.cursor = els.length && onPick ? 'pointer' : 'default';
        },
        scales: {
          x: moneyAxis(t, { beginAtZero: true }),
          y: categoryAxis(t, { ticks: { color: t.ink2, font: { family: fontStack(), size: 12, weight: '500' } } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltipConfig(t, {
            label: function (item) {
              var car = rows[item.dataIndex];
              var out = ['  Profit: ' + C.formatPKR(car.profit)];
              if (car.myShare !== null) out.push('  Your half: ' + C.formatPKR(car.myShare));
              if (car.roiPercent !== null) out.push('  ROI: ' + C.formatPercent(car.roiPercent));
              if (car.profitEstimated) out.push('  (reported figure, not full numbers)');
              return out;
            }
          }),
          directLabels: {
            enabled: true, axis: 'y', theme: t,
            format: function (v) { return (v >= 0 ? '+' : '') + compact(v); }
          }
        }
      }
    });
  }

  /* ---------- 4. cost breakdown for one car ------------------------------- */

  function costBreakdown(canvas, car) {
    ensurePlugin();
    var t = theme();
    var parts = [];

    if (car.purchasePrice !== null) {
      parts.push({ label: 'Purchase price', value: car.purchasePrice, color: t.series[0] });
    }
    C.EXPENSE_CATEGORIES.forEach(function (cat, i) {
      var v = car.expensesByCategory[cat];
      if (v > 0) {
        parts.push({
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          value: v,
          color: t.series[(i + 1) % 8]
        });
      }
    });
    if (car.profit !== null && car.profit > 0) {
      parts.push({ label: 'Profit margin', value: car.profit, color: t.series[2] });
    }

    var chart = make('costBreakdown', canvas, {
      type: 'bar',
      data: {
        labels: [car.name],
        datasets: parts.map(function (p) {
          return {
            label: p.label,
            data: [p.value],
            backgroundColor: p.color,
            borderColor: t.surface,
            borderWidth: 2,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 54
          };
        })
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: 'easeOutQuart' },
        scales: {
          x: moneyAxis(t, { stacked: true, beginAtZero: true }),
          y: categoryAxis(t, { stacked: true, ticks: { display: false } })
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltipConfig(t, {
            label: function (item) {
              var total = parts.reduce(function (a, p) { return a + p.value; }, 0);
              var pct = total ? (item.raw / total * 100).toFixed(1) : '0';
              return '  ' + item.dataset.label + ': ' + C.formatPKR(item.raw) + '  (' + pct + '%)';
            }
          }),
          directLabels: { enabled: false, theme: t }
        }
      }
    });
    if (chart) chart.__parts = parts;
    return chart;
  }

  /* ---------- 5. expense categories --------------------------------------- */

  function expenseCategories(canvas, summary) {
    ensurePlugin();
    var t = theme();
    var slices = C.EXPENSE_CATEGORIES
      .map(function (cat, i) {
        return {
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          value: summary.expenseTotalsByCategory[cat],
          color: t.series[i % 8]
        };
      })
      .filter(function (s) { return s.value > 0; });

    return make('expenseCategories', canvas, {
      type: 'doughnut',
      data: {
        labels: slices.map(function (s) { return s.label; }),
        datasets: [{
          data: slices.map(function (s) { return s.value; }),
          backgroundColor: slices.map(function (s) { return s.color; }),
          borderColor: t.surface,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: tooltipConfig(t, {
            label: function (item) {
              var total = item.dataset.data.reduce(function (a, b) { return a + b; }, 0);
              var pct = total ? (item.raw / total * 100).toFixed(1) : '0';
              return '  ' + item.label + ': ' + C.formatPKR(item.raw) + '  (' + pct + '%)';
            }
          }),
          directLabels: { enabled: false, theme: t }
        }
      }
    });
  }

  /* ---------- legend builder ---------------------------------------------- */
  /* Chart.js' own legend is off everywhere; this one shows the value beside
     each name, which is what makes identity readable without relying on hue. */

  function legendHTML(items) {
    return '<div class="legend">' + items.map(function (item) {
      return '<span class="legend-item">' +
        '<span class="legend-swatch" style="background:' + item.color + '"></span>' +
        '<span>' + item.label + '</span>' +
        (item.value === undefined ? '' : '<span class="legend-value">' + item.value + '</span>') +
        '</span>';
    }).join('') + '</div>';
  }

  root.Charts = {
    theme: theme,
    compact: compact,
    destroy: destroy,
    destroyAll: destroyAll,
    legendHTML: legendHTML,
    profitByMonth: profitByMonth,
    moneySplit: moneySplit,
    profitPerCar: profitPerCar,
    costBreakdown: costBreakdown,
    expenseCategories: expenseCategories
  };
}(window));
