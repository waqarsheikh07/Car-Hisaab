/* Run with: node tests/calc.test.js
   These assertions are the acceptance test for the money math. */
const fs = require('fs');
const path = require('path');
const C = require('../assets/js/calc.js');

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'));
const data = {
  cars: read('cars.json'),
  payouts: read('payouts.json'),
  capital: read('capital.json'),
  settings: read('settings.json')
};

const TODAY = '2026-09-13';
let pass = 0, fail = 0;
function is(actual, expected, label) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}` + (ok ? ` = ${actual}` : `\n        expected ${expected}, got ${actual}`));
}

console.log('\n— Business totals (the figures Usama reported) —');
const b = C.businessSummary(data, TODAY);
is(b.totalProfitAllTime, 415000, 'total profit all time');
is(b.myProfitEarned, 207500, 'my profit earned (50%)');
is(b.partnerProfitEarned, 207500, 'partner profit earned (50%)');
is(b.totalPaidToMe, 70000, 'total paid to me');
is(b.outstandingToMe, 137500, 'OUTSTANDING TO ME');
is(b.carsSoldCount, 4, 'cars sold');
is(b.carsInStockCount, 4, 'cars in stock');
is(b.totalCapitalInvested, 7700000, 'capital invested');

console.log('\n— Per-car —');
const rebirth = data.cars.find(c => c.id === 'rebirth-2012');
is(C.totalCost(rebirth), 2900000, 'Rebirth total cost');
is(C.profit(rebirth), 75000, 'Rebirth profit (real numbers, no override)');
is(C.isProfitEstimated(rebirth), false, 'Rebirth profit is not estimated');
is(C.splitShares(C.profit(rebirth), data.settings).mine, 37500, 'Rebirth my share');

const grande = data.cars.find(c => c.id === 'grande-2019');
is(C.profit(grande), 150000, 'Grande profit (from override)');
is(C.isProfitEstimated(grande), true, 'Grande profit is flagged estimated');
is(C.totalCost(grande), null, 'Grande total cost is unknown, not 0');
is(C.roiPercent(grande), null, 'Grande ROI is unknown, not NaN');

const yaris = data.cars.find(c => c.id === 'yaris-2022');
is(C.profit(yaris), null, 'Unsold car profit is null, never 0');

console.log('\n— Override is only a fallback —');
const filledIn = { ...grande, purchase_price: 3000000, sale_price: 3200000, expenses: [{ id: 'e1', date: '2026-08-01', category: 'repair', amount: 20000 }] };
is(C.totalCost(filledIn), 3020000, 'real cost takes over once entered');
is(C.profit(filledIn), 180000, 'real profit overrides profit_override');
is(C.isProfitEstimated(filledIn), false, 'no longer flagged estimated');

console.log('\n— Formatting —');
is(C.formatPKR(3000000), 'PKR 3,000,000', 'thousand separators');
is(C.formatPKRLong(3000000), 'PKR 3,000,000 (30 lac)', 'lac shorthand');
is(C.formatPKRLong(12500000), 'PKR 12,500,000 (1.25 crore)', 'crore shorthand');
is(C.formatPKRLong(45000), 'PKR 45,000', 'no shorthand under 1 lac');
is(C.formatPKR(null), '—', 'missing money renders as em dash');
is(C.formatPercent(null), '—', 'missing percent renders as em dash');

console.log('\n— Monthly report —');
const months = C.monthlyReport(data, TODAY);
const by = (k) => months.find(m => m.key === k);
is(months[0].key, '2026-06', 'report starts at first activity');
is(months[months.length - 1].key, '2026-09', 'report runs to today');
is(by('2026-06').carsBought, 4, 'Jun 2026 cars bought');
is(by('2026-06').capitalIn, 7700000, 'Jun 2026 capital in');
is(by('2026-07').profit, 140000, 'Jul 2026 profit (Swift)');
is(by('2026-07').paid, 70000, 'Jul 2026 paid to me');
is(by('2026-07').outstanding, 0, 'Jul 2026 running outstanding settles to 0');
is(by('2026-08').profit, 200000, 'Aug 2026 profit (Grande + Cultus)');
is(by('2026-08').outstanding, 100000, 'Aug 2026 running outstanding');
is(by('2026-09').profit, 75000, 'Sep 2026 profit (Rebirth)');
is(by('2026-09').outstanding, 137500, 'Sep 2026 running outstanding = headline figure');
is(months[months.length - 1].outstanding, b.outstandingToMe, 'monthly table ends on the dashboard figure');
is(months[months.length - 1].cumulativeProfit, b.totalProfitAllTime, 'cumulative profit reconciles');

console.log('\n— Data gaps are reported, not hidden —');
is(b.dataGaps.length, 3, 'three kinds of gap flagged');
is(b.dataGaps[0].count, 7, 'seven cars missing a purchase price');

console.log('\n— Splits other than 50/50 —');
const s70 = C.businessSummary({ ...data, settings: { profit_split_investor: 70, profit_split_partner: 30 } }, TODAY);
is(s70.myProfitEarned, 290500, '70% split: my profit');
is(s70.outstandingToMe, 220500, '70% split: outstanding');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
