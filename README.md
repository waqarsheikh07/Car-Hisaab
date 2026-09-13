# Car Hisaab — car investment tracker

A single-page web app that tracks a used-car buying and reselling business: every car,
what it cost, what was spent fixing it, what it sold for, and — the number this whole
thing exists for — **how much of the profit share has actually been paid out**.

All figures are in **PKR**. There is no server and no database: the data lives as four
JSON files in this repository, and the app reads and writes them through the GitHub API
straight from the browser.

---

## The four numbers to check first

With the starter data loaded, the dashboard must show exactly this. If it does, the maths
is wired up correctly:

| Figure | Value |
|---|---|
| Total profit booked | **PKR 415,000** |
| Your share (50%) | **PKR 207,500** |
| Paid to you so far | **PKR 70,000** |
| **Outstanding to you** | **PKR 137,500** |

`node tests/calc.test.js` asserts these and 39 other cases. Run it any time you change the
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

> **Before you make this repository public**, remember that everything in `data/` becomes
> readable by anyone with the link — purchase prices, sale prices, profits, payouts.
> GitHub Pages on a free account only works for public repositories. If you want the data
> private, keep the repository private and either open `index.html` locally or upgrade to
> GitHub Pro, which allows Pages on private repositories.

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
into any file in this repository. **Settings → Disconnect token** removes it.

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
| **Your share / Partner share** | Profit split by the percentages in Settings (50/50 by default). |
| **ROI** | Profit ÷ total cost, as a percentage. Tells you how hard the money worked, independent of deal size. |
| **Days held** | Purchase date to sale date. For an unsold car, purchase date to today — this is how long your capital has been stuck. |

### For the whole business

| Field | How it is worked out |
|---|---|
| **Capital invested** | Everything on the Capital screen added up. |
| **Tied up in unsold cars** | Total cost of every car not yet sold. This money is currently unavailable. |
| **Capital not working** | Capital invested − tied up in unsold cars − paid back to you. Money that should be buying cars but is not. |
| **Total profit all time** | Profit of every sold car added up. |
| **Your profit earned** | Your percentage of that total. What you are *owed*. |
| **Paid to you** | Everything on the Payouts screen added up. What you have actually *received*. |
| **Outstanding to you** | **Your profit earned − paid to you.** The headline figure. If it is large, profit has been booked on paper but has not reached your account. |

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
- **Capital is recorded as PKR 7,700,000** in two entries. Note that 8.7 million was
  mentioned at one point and 77 lac at another — these disagree by 10 lac. Confirm the
  real figure and correct it on the Capital screen; every capital-related number depends
  on it.
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
tests/calc.test.js          43 assertions over the money maths
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

## Exports

Settings → Export gives you a full JSON backup, the monthly report as CSV, and all cars as
CSV. In preview mode, where the browser blocks downloads, the content is shown on screen
to copy instead.
