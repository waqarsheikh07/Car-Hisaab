/* Regenerates assets/js/seed.js from /data/*.json.
   Run after changing seed data:  node scripts/build-seed.js  */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f + '.json'), 'utf8'));
const seed = { cars: read('cars'), payouts: read('payouts'), capital: read('capital'), settings: read('settings') };
const out = `/* seed.js — generated from /data/*.json by scripts/build-seed.js. Do not edit by hand.
   Bundled so the app still works with no network: the shared preview link and
   opening index.html straight off disk both run on this. */
window.SEED_DATA = ${JSON.stringify(seed, null, 2)};
`;
fs.writeFileSync(path.join(root, 'assets', 'js', 'seed.js'), out);
console.log('Wrote assets/js/seed.js');
