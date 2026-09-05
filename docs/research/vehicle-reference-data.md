# Vehicle reference data strategy

Research ticket: [#4](https://github.com/Lucy-yunn/test/issues/4) · Wayfinder map: [#1](https://github.com/Lucy-yunn/test/issues/1)
Status: research complete · not a build ticket
Date: 2026-09-05

---

## Question

What vehicle reference data does the buyer funnel need, and where does it come from?

1. Define the vehicle data model the funnel requires — make / model / generation / year range /
   body style / engine / engine code — and decide which belong in v1.
2. **v1:** define the shape and scope of the hand-curated vehicle list (grilling answer Q24).
3. **Later:** survey data sources for full coverage (TecDoc, commercial car-data APIs, VIN
   decoders, open datasets) with rough coverage, licensing and cost — especially for European
   vehicles.

Output: the v1 vehicle schema + a ranked shortlist of future data sources.

---

## Summary / recommendation

- **v1 reference-data grain is `Make → Model → Generation`.** Generation carries the year range
  (and, optionally, a body-style label). The funnel (`brand → model → year → part category`,
  per Q18/Q25) maps the buyer's chosen year onto a generation internally; the buyer never picks
  a generation, engine, or trim.
- **Engine and engine code are NOT reference entities in v1.** They are free-text / lightly
  structured fields captured on the **Listing** (Provenance, per Q6) and optionally as a
  free-text qualifier on a **Fitment** row. Structured engine-level vehicle identification is
  the TecDoc *KType* problem — thousands of records per model, licensed — and is explicitly out
  of scope for the MVP build.
- **The hand-curated list is seed data**, scoped strictly to the make/model/generation combos
  the pilot sellers' actual stock touches (Q24). Estimate ~10–20 makes, ~40–70 models,
  ~80–140 generations for the demo. Do not hand-type it from nothing — **bootstrap the
  generation names and year ranges from a free open dataset, then hand-verify.**
- **Future sources, ranked:** (1) free open dataset now for seeding + MVP funnel, (2) a one-off
  commercial DB dump (~€190–1,000) when the hand-curated list becomes the bottleneck,
  (3) a commercial EU-capable VIN API for Provenance auto-fill (pay-per-call), (4) NHTSA vPIC
  as a free supplemental VIN check, (5) **TecDoc** as the eventual real fitment database once
  volume and budget justify an annual licence, (6) CarAPI only if inventory pivots to US cars.

**Founder decisions needed** — see the last section.

---

## Part 1 — The v1 vehicle data model

### What the data has to support

Three consumers reference this data (all from the map):

| Consumer | Needs | Grain |
|---|---|---|
| **Funnel search** (Q18/Q25) | brand list → model list → year → part category | Make, Model, year → Generation |
| **Fitment** on the Part (Q6) | "this Part fits these vehicles", manually verified only | set of Generations (+ optional free-text engine/trim note) |
| **Provenance** on the Listing (Q6) | the actual donor vehicle a physical part came off | one Generation + per-listing specifics (engine code, transmission, VIN, mileage, exact year) |

The funnel path stops at **year**. Year is only meaningful once it resolves to a
**generation** (e.g. buyer picks *Golf* + *2016* → *Golf VII (2012–2020)*), because fitment
and parts commonality track generations, not calendar years. So the reference tree needs the
generation layer even though the buyer UI never says the word "generation".

### Recommended v1 entities

```
VehicleMake
  id
  name                e.g. "Volkswagen"
  slug                e.g. "volkswagen"
  country             optional, e.g. "DE" (display only)
  display_order       int (curate popular brands to the top of the funnel)
  is_active           bool

VehicleModel
  id
  make_id             FK -> VehicleMake
  name                e.g. "Golf"
  slug
  display_order
  is_active

VehicleGeneration
  id
  model_id            FK -> VehicleModel
  name                e.g. "VII (Mk7, Typ 5G)"   -- internal / admin label
  year_start          int (year, e.g. 2012)
  year_end            int nullable (null = still in production)
  body_styles         optional: array of enum {hatchback, estate, saloon, suv,
                       coupe, convertible, mpv, van, pickup}  -- see decision D2
  display_order
  is_active
```

Funnel year → generation resolution: a chosen year `Y` matches every generation of that model
where `year_start <= Y <= coalesce(year_end, 9999)`. Overlaps (facelift years, model-change
years) can match two generations — the results list simply unions the fitment of both, which is
the safe behaviour for a used-parts buyer.

### Fitment (lives on the Part, not here — but references this data)

```
PartFitment
  id
  part_id             FK -> Part
  generation_id       FK -> VehicleGeneration     -- the fitment grain in v1
  engine_note         text nullable   -- free text, e.g. "1.6 TDI (CLHA) only", "petrol only"
  verified_by         staff user
  verified_at         timestamp
```

Grain = generation. Any narrower restriction (specific engine, specific facelift, LHD/RHD) is
a human-readable `engine_note` in v1, not a structured constraint. This matches Q6: "manually
verified entries only … do not auto-assume compatibility."

### Provenance (lives on the Listing — references this data + adds per-listing detail)

```
ListingProvenance (fields on / hanging off Listing)
  donor_generation_id   FK -> VehicleGeneration   -- structured link into the reference tree
  donor_year            int nullable   -- the specific production year of the donor car
  engine_code           text nullable  -- e.g. "CLHA", "N47D20", "K9K" — capture verbatim, Q6
  engine_description    text nullable  -- e.g. "1.6 TDI 105hp"
  transmission          enum nullable {manual, automatic, other}   -- Q6 "where relevant"
  vin                   text nullable  -- Q6 "where appropriate"; stored, not decoded in v1
  vin_derived_notes     text nullable
  mileage_km            int nullable
  visible_oem_pn        text nullable  -- Q6
```

The engine code is a **first-class field to capture** (Q6 lists it explicitly) but it is
**per-listing data, not shared reference data**. It never needs a lookup table in v1.

### Which of the requested attributes are in v1

| Attribute | v1? | Where |
|---|---|---|
| **Make** | ✅ entity | `VehicleMake` |
| **Model** | ✅ entity | `VehicleModel` |
| **Generation** | ✅ entity (internal; not shown as a funnel step) | `VehicleGeneration` |
| **Year range** | ✅ | `year_start` / `year_end` on generation |
| **Body style** | ⚠️ optional attribute on generation, **not** a funnel filter | `body_styles` (nullable) — decision D2 |
| **Engine** | ❌ not a reference entity | free text on Listing provenance / fitment note |
| **Engine code** | ❌ not a reference entity (but ✅ captured) | `engine_code` text on Listing provenance |

Rationale for stopping at generation: engine-level vehicle identification (the TecDoc *KType*)
is a licensed dataset with thousands of rows per model, and the map puts "full fitment
database, VIN decoding, automated part-number supersession" **out of scope**. Generation grain
gives the funnel everything it needs and keeps the hand-curated list small enough for one
person to maintain.

---

## Part 2 — The hand-curated v1 vehicle list

### Scope (Q24: "only the brands / models the first pilot sellers' stock actually needs")

The list is **demand-driven, not comprehensive**:

1. Run seller intake first. For each pilot seller, collect the set of donor vehicles their
   current stock came from (make / model / rough year).
2. Reduce to distinct `Make → Model → Generation` rows. That set **is** the v1 list.
3. Add nothing "just in case." A brand with no pilot stock does not go in the funnel — an
   empty funnel branch is worse than a missing one.

**Expected size for the demo:** ~10–20 makes, ~40–70 models, ~80–140 generations. Small enough
to live in a single seed file.

**Bulgaria context to expect in the pilot stock** (informs, does not pre-empt, the intake):
predominantly European mass-market brands, older fleet, heavy diesel share, many ex-German
imports. Likely core: Volkswagen, Opel, BMW, Mercedes-Benz, Audi, Ford, Renault, Peugeot,
Citroën, Škoda, Toyota, Nissan, Fiat, Hyundai/Kia, Dacia. Year span roughly **1998–present**
(dismantlers live off 12–25-year-old cars). Confirm N1 vans (Transporter, Sprinter, Transit,
Berlingo/Partner) with the founder — decision D6.

### Shape / storage

- **Seed fixture in the repo** — one file (JSON or YAML) under the repo's seed/fixtures
  location, version-controlled, loaded into the `VehicleMake/Model/Generation` tables on
  demo setup. This is the source of truth for v1.
- Same three tables the app queries at runtime — the fixture is just how they get populated.
- **Admin CRUD for the vehicle list is deferred** (not in the Q20 v1 admin scope of Order +
  Product Management). For v1, edits happen in the fixture + reload. Note this as future work.
- Ship an `is_active` flag so a make/model can be hidden from the funnel without deleting rows
  that fitment/provenance already point at.

### Bootstrapping the fixture (do not hand-type year ranges)

Generation names, year ranges and body styles are exactly what the free open datasets in
Part 3 already contain. Recommended flow:

1. Take the pilot stock's make/model list.
2. Pull those models' generations + year ranges + body types from
   [`gor3a/vehicle-makes-models`](https://github.com/gor3a/vehicle-makes-models) (ODbL) — it
   has generation, `body_type`, `year_start`, `year_end` fields — or from Wikipedia
   (CC BY-SA) for anything missing or wrong.
3. Hand-verify every row against Wikipedia / the manufacturer. Curated list is small, so this
   is an afternoon, not a project.
4. Set `display_order` so the common brands sit at the top of the funnel.

Licensing note: if the fixture is seeded from `gor3a/vehicle-makes-models`, the vehicle data
is under **ODbL 1.0** (attribution + share-alike on the database). A short attribution line
plus willingness to share back corrections satisfies it. Alternatives that avoid ODbL:
hand-curate from Wikipedia (CC BY-SA — similar obligations), or buy a commercial dump
(car2db, ~€190 — redistribution restricted but no share-alike). See decision D4.

---

## Part 3 — Future data sources survey

Goal: full(er) coverage once the hand-curated list is the bottleneck. Two distinct needs —
**(A)** the funnel/provenance *vehicle tree* (make/model/generation), and **(B)** *fitment*
(which parts fit which vehicles). They are different problems with different vendors.

### A. Vehicle-tree sources

#### 1. Open datasets — free

| Dataset | Contents | Coverage | Licence | Cost |
|---|---|---|---|---|
| [`gor3a/vehicle-makes-models`](https://github.com/gor3a/vehicle-makes-models) | make → model → generation → engine; 164 makes / 2,621 models / 7,169 generations / 30,390 engine variants; JSON/CSV/SQLite; weekly releases | Global, incl. European brands; depth uneven per model | Code MIT, **data ODbL 1.0** | Free |
| [`plowman/open-vehicle-db`](https://github.com/plowman/open-vehicle-db) | make / model / year / style | Mixed, US-leaning | Open | Free |
| [`abhionlyone/us-car-models-data`](https://github.com/abhionlyone/us-car-models-data) | ~15,000 model rows, 1992–2026 | **US market only** | CC0 | Free |
| [Back4App Car Make/Model dataset](https://www.back4app.com/database/back4app/car-make-model-dataset) | make/model/category/year | US 1992–2022 | Open via API | Free tier |

- **Verdict:** `gor3a/vehicle-makes-models` is the one to use — it is the only free set with an
  explicit **generation + body_type + year-range** structure and non-trivial European coverage.
  Caveats: community-maintained, sparse fields, no SLA, no guarantee a given European model's
  generations are complete or correct — hence "seed then verify," not "import and trust."
  The CC0 US datasets are the wrong market for Bulgaria.

#### 2. Commercial database dumps — low one-off cost

| Vendor | Contents | Coverage | Licence | Cost |
|---|---|---|---|---|
| [car2db.com](https://car2db.com/) | make/model/generation/trim + body/engine/transmission/dimensions; 411 makes / 5,297 models / 86,825 trims; since 1972 (most from 1972+); monthly updates | Global incl. Europe, Japan, India, Australia | Commercial, per-format purchase; redistribution restricted | Excel **$190**; MySQL / CSV / API tiers higher |
| teoalida / databaseatlas.com | year/make/model/trim/engine; US + Europe + Japan variants | Broad, configurable | Commercial, custom | Custom quote (hundreds–low thousands €) |

- **Verdict:** the cheapest route to a *complete* funnel + provenance tree without an ongoing
  contract. Buy once, re-buy on a monthly/annual refresh if needed. No fitment linkage. Good
  stepping stone between the hand-curated list and TecDoc.

#### 3. CarAPI ([carapi.app](https://carapi.app/) / [carapi.dev](https://carapi.dev/)) — cheap subscription, wrong market

- **Contents:** REST/JSON; year/make/model (1900–2026), trims (1990–2026), bodies, engines,
  mileage, VIN decode, plate decode, OBD-II codes. ~90,000 models / ~77,000 trims.
- **Coverage:** **models sold in the United States** — weak for European-only nameplates,
  trims and diesel engine variants (Opel Astra, Peugeot 308, Škoda Octavia European trims,
  1.6 TDI / 1.5 dCi engine codes). Free tier is 2015–2020 only.
- **Licence / cost:** subscription, no redistribution. Base **$199/yr** (1,500 req/day),
  Plus $249, Premium $299.
- **Verdict:** clean API, fair price, but US-centric coverage is a poor fit for a
  Bulgaria-first parts yard. Only relevant if inventory pivots to US vehicles.

### B. Fitment + VIN sources

#### 4. TecDoc / TecAlliance ([tecalliance.net](https://www.tecalliance.net/tecdoc-catalogue/)) — the European standard, gated

- **What it is:** the manufacturer-independent European aftermarket data standard. Vehicle
  grain is the **KType** number — a numeric ID for `brand + model + type + engine + year`
  that part suppliers link their catalogue entries to. In European aftermarket systems a
  licence plate or VIN is resolved internally to a KType, then parts are matched on KType
  ([ref](https://www.linkedin.com/pulse/limitations-tecdoc-ktype-joan-cab%C3%B3s)).
- **Coverage:** best-in-class for European passenger cars and LCVs, and the only option that
  ships **real part-to-vehicle fitment** rather than just a vehicle tree.
- **Licence:** commercial licence mandatory, held by the operator, **annual renewal**, no
  self-serve for redistribution/marketplace use
  ([shop](https://shop.tecalliance.net/tecdoc-catalogue-classic/5637251092.p)).
- **Cost:** **not published.** Model is typically *a percentage of shop turnover + an annual
  minimum*, varying by data package (article groups, vehicle types, languages), refresh
  frequency, and delivery (web service vs DB export). Effectively an enterprise contract —
  heavy for a solo operator.
- **Verdict:** the eventual destination for a real fitment database (map: "architecture stays
  ready for a real fitment database later"). Revisit when listing volume and revenue justify
  the contract and the integration work. Not an MVP or early-growth purchase.

#### 5. NHTSA vPIC ([vpic.nhtsa.dot.gov/api](https://vpic.nhtsa.dot.gov/api/)) — free, US-biased

- **Endpoints:** `DecodeVin` / `DecodeVinValues` / `DecodeVinExtended` (partial VIN + model
  year supported; batch up to 50 VINs), `GetAllMakes`, `GetModelsForMake`,
  `GetModelsForMakeYear`, WMI lookups.
- **Coverage:** vehicles sold/regulated in the **US since 1981**. Foreign vehicles appear only
  where the manufacturer filed a US Part 565 submittal; **European-market-only variants,
  trims and engine codes are largely absent or generic**, and decoding an EU-market VIN
  returns thin results. `GetAllMakes` returns **12,356 makes** (verified 2026-09-05) — mostly
  trailer/custom builders — so it is unusable as a raw funnel source without heavy filtering.
- **Licence:** US Government work — **public domain, no licence, no fee.** Automated rate
  limiting, no published threshold.
- **Verdict:** keep as a **free supplemental VIN sanity-check / auto-fill** for provenance
  when a donor VIN happens to be a globally-filed or US-spec vehicle. Not the backbone of
  anything European.

#### 6. Commercial EU-capable VIN APIs — pay-per-call, for Provenance auto-fill

| Provider | Returns | EU coverage | Pricing | Licence |
|---|---|---|---|---|
| [Vincario / vindecoder.eu](https://vindecoder.eu/api/) | 50+ fields: make, model, year, body, engine type, fuel, doors, weight, dimensions, plant | "extended support of European and North American vehicles" | ~**€0.20–0.50 per VIN decode**; OEM-level ~€2; 3 free reports/month | Per-call, ToS-restricted; not for bulk storage/redistribution |
| vehicledatabases.com / CarsXE / Zyla EU VIN APIs | similar decode payloads | marketed as EU-capable; quality varies | per-call, similar band | per-call ToS |

- **Verdict:** the right tool for **auto-filling the Q6 provenance fields** (engine code, body,
  fuel, plant) from a donor VIN — better European hit-rate than NHTSA. Pay-per-call, so cost
  scales with listing volume, not a fixed commitment. **Not** a way to build the funnel tree.
- **Not the same as** carVertical (€29.99/report) or Carlytics (€8.90/report) — those are
  *vehicle history* reports (mileage, damage, theft) aimed at car buyers, not reference data.
  Out of scope here.

#### 7. National vehicle registries / EReg — authoritative, not a product

Per-country registries (Bulgaria's KAT, DE KBA, etc.) hold authoritative data but access is
regulated and not sold as a marketplace-usable feed. Enterprise valuation catalogues
(DAT/Schwacke, Autovista/Eurotax, JATO) are OEM-catalogue/pricing products at enterprise cost
— overkill. Note and dismiss for the foreseeable roadmap.

### Ranked future-source shortlist

| # | Source | Use | Coverage (esp. EU) | Licence | Cost | When |
|---|---|---|---|---|---|---|
| 1 | [`gor3a/vehicle-makes-models`](https://github.com/gor3a/vehicle-makes-models) | Seed the hand-curated list; MVP funnel tree | Global, EU present but uneven/unverified | ODbL 1.0 (data) | Free | Now |
| 2 | [car2db.com](https://car2db.com/) dump (or teoalida) | Full funnel + provenance tree past the curated list | Global incl. EU, good | Commercial, one-off; redistribution restricted | ~€190–1,000 one-off | When curated list can't keep up |
| 3 | [Vincario VIN API](https://vindecoder.eu/api/) | Auto-fill provenance fields from donor VIN | EU + NA, decent | Per-call ToS | ~€0.2–0.5 / VIN | When staff VIN entry volume hurts |
| 4 | [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) | Free supplemental VIN check | US since 1981; thin for EU-only | Public domain | Free | Anytime, optional |
| 5 | [TecDoc / TecAlliance](https://www.tecalliance.net/tecdoc-catalogue/) | Real part↔vehicle **fitment** DB (KType) | Best-in-class EU | Annual commercial licence, operator-held | Enterprise (% turnover + minimum) | When volume + revenue justify the contract |
| 6 | [CarAPI](https://carapi.app/) | Vehicle tree + VIN, if inventory goes US | **US market only** | Subscription | $199–299/yr | Only if pivoting to US cars |

---

## Decisions the founder must make

- **D1 — Funnel grain.** Confirm the v1 funnel stops at `brand → model → year` and never asks
  the buyer for a generation, engine, or trim (consistent with Q18/Q25). *Recommendation:
  confirm as stated.*
- **D2 — Body style in v1.** Include `body_styles` as an optional display attribute on a
  generation (e.g. show "Golf VII Estate"), but **not** as a funnel filter step?
  *Recommendation: yes — optional attribute, no funnel step. It helps staff disambiguate and
  reads nicely on results, at near-zero cost.*
- **D3 — Curated-list storage.** Accept that the v1 vehicle list lives in a repo seed fixture
  and is edited by fixture + reload, with admin CRUD for vehicles deferred beyond the Q20 v1
  admin scope? *Recommendation: yes.*
- **D4 — Seed-data licence.** Is ODbL 1.0 acceptable for the seeded vehicle data (needs an
  attribution line + willingness to publish corrections back)? If not: hand-curate from
  Wikipedia (CC BY-SA), or budget ~€190 for a car2db dump with no share-alike.
  *Recommendation: ODbL is fine for a demo; revisit at real launch.*
- **D5 — Future-budget signal.** At build/growth time, is there appetite for a ~€200–1,000
  one-off commercial dump (car2db/teoalida), or is the roadmap strictly free/open until TecDoc?
  This changes whether source #2 above is real.
- **D6 — Commercial vehicles (N1 vans).** Are light commercial vans (Transporter, Sprinter,
  Transit, Berlingo/Partner) expected in the pilot sellers' stock, and therefore in the v1
  list? Affects list scope and, later, which TecDoc package would be needed.

---

## Sources

Primary sources consulted (accessed 2026-09-05):

- NHTSA vPIC API — <https://vpic.nhtsa.dot.gov/api/> ; `GetAllMakes` live response
  (<https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json> — 12,356 makes)
- TecAlliance / TecDoc Catalogue — <https://www.tecalliance.net/tecdoc-catalogue/> ;
  <https://shop.tecalliance.net/tecdoc-catalogue-classic/5637251092.p> ;
  TecDoc Data Format spec — <https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf>
- "Limitations of the TecDoc ktype", J. Cabós —
  <https://www.linkedin.com/pulse/limitations-tecdoc-ktype-joan-cab%C3%B3s>
- CarAPI — <https://carapi.app/> ; pricing <https://carapi.app/pricing/> ;
  <https://carapi.dev/>
- car2db.com — <https://car2db.com/> ; Excel pricing <https://car2db.com/excel/>
- teoalida / databaseatlas car database — <https://www.teoalida.com/cardatabase/>
- Vincario / vindecoder.eu VIN Decoder API — <https://vindecoder.eu/api/> ;
  pricing overview <https://vincario.com/blog/vin-decoder-api-pricing/>
- `gor3a/vehicle-makes-models` (ODbL 1.0) — <https://github.com/gor3a/vehicle-makes-models>
- `plowman/open-vehicle-db` — <https://github.com/plowman/open-vehicle-db>
- `abhionlyone/us-car-models-data` (CC0) — <https://github.com/abhionlyone/us-car-models-data>
- Back4App Car Make/Model dataset — <https://www.back4app.com/database/back4app/car-make-model-dataset>
- EU vehicle categories M1 / N1, Regulation (EU) 2018/858 —
  <https://www.transportpolicy.net/standard/eu-vehicle-definitions/> ;
  <https://alternative-fuels-observatory.ec.europa.eu/general-information/vehicle-types>
- Secondary / comparative (used only for orientation, not for claims):
  Smartcar "10 Car Database APIs" <https://smartcar.com/blog/car-database-api> ;
  Cardog free VIN decoder comparison <https://cardog.app/blog/free-vin-decoder-api-comparison>
