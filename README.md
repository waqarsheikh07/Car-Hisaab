# Car Hisaab — car investment tracker

A single-page web app that tracks a used-car buying and reselling business: every car,
what it cost, what was spent fixing it, what it sold for, and — the number this whole
thing exists for — **how much of the profit share has actually been paid out**.

All figures are in **PKR**. There is no server and no database: the data lives as four
JSON files in this repository, and the app reads and writes them through the GitHub API
straight from the browser.

---

## Testing

`node tests/calc.test.js` — 85 assertions, and it needs no browser.

The money maths is pinned against a **frozen fixture** in `tests/fixture.json`, the
original eight-car starter set, where the totals must come out at exactly
415,000 profit / 207,500 your share / 70,000 paid / 137,500 outstanding. That fixture
never changes, so the suite tests the *calculations* rather than the current state of
the business.

Your live `data/*.json` is checked separately, by invariants that must hold no matter
what the numbers are: ids unique, statuses valid, every expense and payout a usable
number, no car with a NaN profit, each car's two percentages between 0 and 100 and
summing to 100, the two profit shares adding up to the total, outstanding equalling
earned minus paid, and the monthly table's final row landing on the dashboard figure.

That separation is deliberate. Asserting against the live files would mean every car
you buy breaks the test suite. Run it any time you change the
money maths.

---

## Running it

### Just look at it

Open `index.html` in a browser. With no web server and no token it runs on the bundled
sample data and keeps any edits in that browser only — nothing is sent anywhere. This is
also what the shared preview link runs on.

### Host it on GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Under *Build and deployment*, set **Source: Deploy from a branch**.
3. Choose branch **`main`** and folder **`/ (root)`**. Save.
4. Wait about a minute. The site appears at
   `https://<your-username>.github.io/Car-Hisaab/`.

> **This repository is public, so the figures in `data/` are readable by anyone with the
> link** — purchase prices, sale prices, profits and payouts. That is the trade for free
> GitHub Pages hosting; there is no login on the site. To reverse it: Settings → General →
> Danger Zone → Change visibility → Make private, which also turns Pages off. The private
> alternative is running it locally: `python3 -m http.server` in this folder, then open
> `http://localhost:8000`.

### Connect a token so you can edit

Without a token the hosted site is **read-only** — every add and edit button is disabled.
To make changes:

1. Go to <https://github.com/settings/personal-access-tokens/new> (Settings → Developer
   settings → Personal access tokens → **Fine-grained tokens** → Generate new token).
2. **Token name:** anything, e.g. `car-hisaab`.
3. **Expiration:** your choice. You will need to generate a new one when it expires.
4. **Repository access:** *Only select repositories* → pick **this repository only**.
5. **Permissions → Repository permissions → Contents:** set to **Read and write**.
   Nothing else is needed.
6. Generate the token and copy it. GitHub shows it once.
7. In the app, open **Settings**, fill in your username, the repository name, the branch
   (`main`) and paste the token, then press **Test & connect**.

The token is kept in that browser's `localStorage` and nowhere else. It is never written
into any file in this repository, never put in a URL, and never rendered into the page —
the token box is always shown empty, and leaving it blank keeps the one already saved.
**Settings → Disconnect token** removes it.

**The app must be served over http(s) for this to work.** Opening `index.html` straight
from disk (a `file://` address) means the browser blocks all requests to github.com, and
the shared preview link runs in a sandbox that blocks them too — in both cases connecting
fails with a network error. Use the GitHub Pages address, or serve the folder locally
(`python3 -m http.server` in this directory, then open `http://localhost:8000`). The app
detects both situations and says so on the Settings screen.

Every change you make after that becomes a real commit on the branch, so you get full
history and can always see who changed what and when.

---

## What every number means

Hand this section to your partner — it explains each figure in plain language.

### For one car

| Field | How it is worked out |
|---|---|
| **Total cost** | Purchase price + every expense logged against the car (repairs, parts, paint, transport, registration, commission, other). |
| **Profit** | Sale price − total cost. Blank until the car is sold. |
| **Your share / Partner share** | Profit split by *this car's own* percentages — see **When the partner helps pay** below. On a car you funded alone this is the agreed 50/50. |
| **Who paid** | How much of the car was your money and how much was the partner's. Blank means you paid for all of it. |
| **ROI** | Profit ÷ total cost, as a percentage. Tells you how hard the money worked, independent of deal size. |
| **Days held** | Purchase date to sale date. For an unsold car, purchase date to today — this is how long your capital has been stuck. |

### For the whole business

| Field | How it is worked out |
|---|---|
| **Capital invested** | Everything on the Capital screen added up. |
| **Tied up in unsold cars** | **Your** money in cars not yet sold. If the partner part-funded a car, only your side of it counts here. |
| **Partner's money in stock** | His money in unsold cars. Shown separately and excluded from every figure about you. Only appears when he has actually funded something. |
| **Capital not working** | Your capital invested − your money tied up in unsold cars − paid back to you. Money of yours that should be buying cars but is not. |
| **Total profit all time** | Profit of every sold car added up. |
| **Your profit earned** | Your percentage of that total. What you are *owed*. |
| **Paid to you** | Everything on the Payouts screen added up. What you have actually *received*. |
| **Outstanding to you** | **Your profit earned − paid to you.** The headline figure. If it is large, profit has been booked on paper but has not reached your account. |

### When the partner helps pay

Normally you fund the cars and the partner does the work, which is what the 50/50 is
for. When he also puts money into a car, that car alone divides differently.

Profit splits into two pots:

- the **money pot** — 50% of profit by default — divided exactly the way the car was
  paid for, so every rupee either of you put in earns the same rate;
- the **work pot** — the rest — for sourcing it, fixing it and selling it, which is his.

A car you paid for alone gives you the whole money pot and him the whole work pot:
**50/50, unchanged**. Nothing in your existing figures moves.

Worked example. A 5,000,000 car, 2,000,000 yours and 3,000,000 his, sold for 5,400,000:

```
profit                                        400,000

money pot (50%)                               200,000
  you      2,000,000 of 5,000,000  = 40%   ->  80,000   (4.0% on your money)
  partner  3,000,000 of 5,000,000  = 60%   -> 120,000   (4.0% on his money)

work pot (50%)                                200,000
  partner                                   -> 200,000

  YOU                                           80,000   = 20% of this car
  PARTNER                                      320,000   = 80% of this car
```

Both of you earn the same 4% on every rupee of capital; he earns the work fee on top.
The car detail screen shows those two percentages and the split bar for every car.

**The dial.** Settings → *Of profit, how much rewards the money* controls the size of
the money pot. At **100** profit follows the money exactly and the work counts for
nothing — a car you fund alone becomes 100% yours. At **0** funding is ignored and
everything stays 50/50. It cannot be set above your baseline share, because that would
imply a negative work share. Leave it at 50 unless you and your partner agree otherwise.

This is an accounting model, not an agreement. **Agree the numbers with your partner
before relying on them** — the dial changes what you are owed.

### The monthly table

One row per month, from the first thing that happened up to today. The final column,
**Outstanding**, carries forward: each month it adds that month's share of profit and
subtracts anything paid to you that month. The last row therefore always equals the big
number on the dashboard. Click any month to see the cars behind it.

---

## Honest gaps in the starter data

The app flags these itself in an amber banner rather than hiding them. They come from what
was shared over WhatsApp, not from a full set of books.

- **Seven cars have no purchase price.** Only Rebirth's (2,900,000) is known. Until the
  rest are filled in, *tied up in unsold cars* is understated and *capital not working*
  is overstated by the same amount.
- **Three sold cars use a reported profit figure** rather than real numbers: Swift
  (140,000), Grande (150,000) and Cultus (50,000). These sit in a `profit_override` field.
  The moment you enter a real purchase price and sale price for one of them, the override
  is ignored and the profit is calculated properly — the app does that switch on its own.
- **Every date is an estimate.** Cars are marked *dates unconfirmed* until you correct
  them. Dates only affect which month a figure lands in, not any total.
- **Capital is PKR 7,700,000 (77 lac)** — confirmed. It is recorded as two entries: the
  500,000 token amount sent on 11 June 2026, and the 7,200,000 balance on the same date.
  The balance is a placeholder date: split it into the real transfers, with their real
  dates, on the Capital screen. Dates only change which month each entry lands in, not
  the total.
- **Rebirth's 2,900,000 was described as total cost**, so it is recorded as the purchase
  price with no expenses. If part of it was repair spend, split it out into expenses so
  the cost breakdown is accurate.

---

## Data files

Everything lives in `data/`. You can edit these by hand on GitHub if you prefer.

**`cars.json`** — one object per car. `status` is `in_stock`, `under_repair`, `listed` or
`sold`. Expenses are nested inside the car, so every rupee spent is attached to something.

```json
{
  "id": "yaris-2022",
  "name": "Yaris",
  "model_year": 2022,
  "purchase_date": "2026-08-05",
  "purchase_price": 3000000,
  "status": "in_stock",
  "sale_date": null,
  "sale_price": null,
  "profit_override": null,
  "image_url": "",
  "expenses": [
    { "id": "e1", "date": "2026-08-25", "category": "repair", "amount": 20000, "note": "suspension" }
  ],
  "notes": ""
}
```

Add `funding` to a car only when the partner helped pay for it:

```json
"funding": { "investor": 2000000, "partner": 3000000 }
```

Leave it out and the car is treated as entirely yours, which is the normal case. If the
two figures do not add up to what the car cost, the app says so rather than quietly
using them.

**`settings.json`** also carries `capital_reward_percent` (the money pot, default 50).

**`payouts.json`** — money that actually reached you. `car_id` is optional; leave it out
for a lump sum.

**`capital.json`** — your transfers into the business.

**`settings.json`** — profit split percentages and the two names.

A missing number must be `null`, never `0`. The app shows `—` for unknown and never
invents a zero, because a zero would quietly corrupt every total above it.

---

## How it is built

Plain HTML, CSS and vanilla JavaScript. No framework, no build step, no `npm install` —
the files you see are the files that run.

```
index.html                  markup and script order
assets/css/style.css        design tokens, light + dark, responsive
assets/js/calc.js           all money maths — pure functions, no DOM
assets/js/github.js         token handling, reads and writes, conflict retry
assets/js/charts.js         every Chart.js instance
assets/js/render.js         shared components + the dashboard
assets/js/views.js          cars, car detail, payouts, capital, settings
assets/js/app.js            routing, state, events, forms, exports
assets/js/icons.js          the 37 icons, inlined
assets/js/art.js            illustrations and the car placeholder, inlined SVG
assets/js/seed.js           generated — starter data bundled for offline use
assets/vendor/              Chart.js 4.4.1 (MIT), vendored
data/*.json                 the database
tests/calc.test.js          73 assertions over the money maths
scripts/build-seed.js       regenerates seed.js from data/
```

**Why calc.js is separate:** every rupee figure in the app comes from one file of pure
functions with no DOM access. That is what makes the maths testable, and what lets
`tests/calc.test.js` prove the totals without a browser.

After editing anything in `data/`, run `node scripts/build-seed.js` so the bundled
offline copy matches.

### Performance notes

- **No webfonts.** The system UI font is used throughout, so text paints immediately.
- **No icon library.** The 37 icons used are inlined as SVG, which removed a ~300KB
  script and means icons render even if every external request fails.
- **Chart.js is vendored**, not loaded from a CDN, so a blocked or down CDN cannot break
  the dashboard. It is the only third-party runtime dependency (~68KB gzipped).
- Total JavaScript the app itself ships is under 90KB uncompressed.

### Chart colours

The palette is colourblind-safe and was validated programmatically in both light and dark
mode — worst-case colour separation under simulated protanopia and deuteranopia clears the
required threshold. Two consequences worth knowing:

- Profit and loss are shown **blue and red**, not green and red. Green/red is the one pair
  a large share of colourblind readers cannot tell apart. Sign and direct labels carry the
  meaning too, so colour is never the only channel.
- Every chart has a **Table** toggle beside it, because some palette colours sit below the
  3:1 contrast threshold against the light background and a text alternative is required.

---

## If two people edit at once

The app never overwrites a change it did not make. Each save is pinned to the version of
the file it was based on. If the file changed on GitHub in the meantime — you editing on
another device, or a change made directly on github.com — the save is **refused** and you
are asked what to do:

- **Reload from GitHub** discards the change you just made here and shows the current
  version, so you can redo it on top. This is almost always the right choice.
- **Overwrite anyway** keeps your version. The other edit stays in the repository history
  but is gone from the file.

This matters because the obvious implementation — re-read, then retry the write — silently
destroys the other person's edit. It is not what this app does.

## If the same file is edited twice

The app never overwrites a change it did not make. Every save is pinned to the version it
was based on. If the file moved on GitHub in the meantime — you on another device, or an
edit made directly on github.com — the save is **refused** and you choose:

- **Reload from GitHub** throws away the change you just made and shows the current
  version, so you can redo it on top. Almost always the right choice.
- **Overwrite anyway** keeps your version. The other edit survives in the repository
  history but is gone from the file.

This matters because the obvious implementation — re-read, then retry the write — silently
destroys the other edit. That is not what this app does.

## Exports

Settings → Export gives you a full JSON backup, the monthly report as CSV, and all cars as
CSV. In preview mode, where the browser blocks downloads, the content is shown on screen
to copy instead.
