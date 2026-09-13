/* seed.js — generated from /data/*.json by scripts/build-seed.js. Do not edit by hand.
   Bundled so the app still works with no network: the shared preview link and
   opening index.html straight off disk both run on this. */
window.SEED_DATA = {
  "cars": [
    {
      "id": "swift-2018",
      "name": "Swift",
      "model_year": null,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-06-15",
      "purchase_price": null,
      "status": "sold",
      "sale_date": "2026-07-10",
      "sale_price": null,
      "profit_override": 140000,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Only the profit figure (140,000) was shared. Replace profit_override with real purchase_price, expenses and sale_price once Usama confirms. Dates are estimates."
    },
    {
      "id": "rebirth-2012",
      "name": "Rebirth",
      "model_year": 2012,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-06-25",
      "purchase_price": 2900000,
      "status": "sold",
      "sale_date": "2026-09-05",
      "sale_price": 2975000,
      "profit_override": null,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "2,900,000 was quoted as total cost. If any of it was repair spend, split it out into expenses so the cost breakdown is accurate. Dates are estimates."
    },
    {
      "id": "grande-2019",
      "name": "Grande",
      "model_year": 2019,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-07-15",
      "purchase_price": null,
      "status": "sold",
      "sale_date": "2026-08-20",
      "sale_price": null,
      "profit_override": 150000,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Only the profit figure (150,000) was shared. Replace profit_override with real purchase_price, expenses and sale_price. Dates are estimates."
    },
    {
      "id": "cultus-2019",
      "name": "Cultus",
      "model_year": 2019,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-07-30",
      "purchase_price": null,
      "status": "sold",
      "sale_date": "2026-08-28",
      "sale_price": null,
      "profit_override": 50000,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Only the profit figure (50,000) was shared. Replace profit_override with real purchase_price, expenses and sale_price. Dates are estimates."
    },
    {
      "id": "yaris-2022",
      "name": "Yaris",
      "model_year": 2022,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-08-05",
      "purchase_price": null,
      "status": "in_stock",
      "sale_date": null,
      "sale_price": null,
      "profit_override": null,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Purchase price not shared yet. Ask Usama. Purchase date is an estimate."
    },
    {
      "id": "cocoa-2016",
      "name": "Cocoa",
      "model_year": 2016,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-07-22",
      "purchase_price": null,
      "status": "in_stock",
      "sale_date": null,
      "sale_price": null,
      "profit_override": null,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Purchase price not shared yet. Ask Usama. Purchase date is an estimate."
    },
    {
      "id": "liana-2006",
      "name": "Liana",
      "model_year": 2006,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-06-18",
      "purchase_price": null,
      "status": "in_stock",
      "sale_date": null,
      "sale_price": null,
      "profit_override": null,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Purchase price not shared yet. Ask Usama. Purchase date is an estimate."
    },
    {
      "id": "xe-2001",
      "name": "XE",
      "model_year": 2001,
      "registration": "",
      "image_url": "",
      "purchase_date": "2026-06-20",
      "purchase_price": null,
      "status": "in_stock",
      "sale_date": null,
      "sale_price": null,
      "profit_override": null,
      "buyer_note": "",
      "needs_confirmation": true,
      "expenses": [],
      "notes": "Purchase price not shared yet. Ask Usama. Purchase date is an estimate."
    }
  ],
  "payouts": [
    {
      "id": "p1",
      "date": "2026-07-14",
      "amount": 70000,
      "method": "bank",
      "note": "First profit share — exactly half of Swift's 140,000 profit",
      "car_id": "swift-2018"
    }
  ],
  "capital": [
    {
      "id": "c1",
      "date": "2026-06-11",
      "amount": 500000,
      "note": "Token amount (first transfer)"
    },
    {
      "id": "c2",
      "date": "2026-06-11",
      "amount": 7200000,
      "note": "Balance of the confirmed 77 lac (PKR 7,700,000) investment — split this into the real transfers and their real dates"
    }
  ],
  "settings": {
    "profit_split_investor": 50,
    "profit_split_partner": 50,
    "partner_name": "Usama",
    "investor_name": "Waqar",
    "currency": "PKR",
    "business_name": "Car Investment Tracker"
  }
};
