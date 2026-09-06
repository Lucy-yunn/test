# Seller inventory data-intake mechanism — v1

Resolves [Seller inventory data-intake mechanism (#14)](https://github.com/Lucy-yunn/test/issues/14)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

v1 listing entry is **staff-entry** (locked Q10) and this ticket does **not** change that. It
designs the **handoff**: how a Seller's raw inventory reaches Staff so Staff can create the
`DonorVehicle` + `Listing` records defined in [`docs/domain-model.md`](./domain-model.md) and
[Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8).

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md). The `DonorVehicle`, `Listing`,
`ListingPhoto`, and `ListingDefect` entities live in [`docs/domain-model.md`](./domain-model.md);
this document owns only the intake process and its one artifact, the **seller intake sheet**.

**This ticket adds no application code.** Its deliverables are this document, the intake sheet
template, and the staff ops checklist in §7.

---

## 1. Shape of the handoff

- **One channel: the seller intake sheet.** A spreadsheet workbook Staff hand to the Seller,
  the Seller fills in, and returns with a folder of photos. Staff then transcribe it into the
  admin tool. There is no web form and no seller login in v1 (see §6).
- **No `SellerSubmission` entity.** The sheet is an out-of-band working file, not a platform
  record. Returned workbooks and raw photo folders live in a plain shared drive (e.g. Google
  Drive), one folder per submission. Traceability for the handful of v1 sellers comes from
  `Listing.createdBy`, `DonorVehicle.sellerId`, and `DonorVehicle.notes`.
- **The template is medium-flexible in practice.** The sheet is the documented happy path;
  where a seller genuinely cannot use it, Staff take the data by call / message and fill the
  sheet themselves. The sheet's column set is still the contract for *what* Staff need.

---

## 2. The seller intake sheet

**One workbook per seller batch.** Donor-first, mirroring the admin listing flow in #8: two
working tabs plus hidden reference tabs.

### 2.1 `Vehicles` tab — one row per donor car

| Column | Req | Notes |
|---|---|---|
| Vehicle label | ✅ | The seller's own reference for this car (e.g. `Silver Golf 2016`). `Parts` rows point at this label. |
| Make | ✅ | Dropdown, from the `Makes` reference tab. |
| Model | ✅ | Dropdown, from the `Models` reference tab (filtered by Make) — the grouped Model value (`A4, S4`). |
| Generation | ✅ | Dropdown, from the `Generations` reference tab (filtered by Model), **or** the `— NOT LISTED —` sentinel (see §2.4). |
| Not-listed vehicle details | — | Free text — required only when Generation = `— NOT LISTED —`: make, model, year, chassis code, engine, engine code as the seller knows them. |
| Year | — | Optional. |
| VIN | — | Optional. Shown **masked** to buyers (#8). |
| Mileage (km) | — | Optional. |
| Engine | — | Optional — e.g. `2.0 TDI 150hp`. Shown on the Listing (#9 §2.1). |
| Engine code | — | Optional — as physically stamped. Shown on the Listing. |
| Fuel | — | Optional dropdown: `petrol` / `diesel` / `hybrid` / `electric` / `lpg` / `other`. |
| Transmission | — | Optional dropdown: `manual` / `automatic` / `other`. |
| Body style | — | Optional — e.g. `saloon`, `estate/avant`, `hatchback`. |
| Drivetrain | — | Optional — e.g. `fwd`, `rwd`, `awd/quattro`. |
| Registration country | — | Optional. |
| Notes | — | Optional free text for Staff. |

The engine / fuel / transmission / body / drivetrain columns are the structured
`DonorVehicle` detail (#21) shown to buyers on each Listing — the seller fills what they know;
Staff key it as-is. They are **not** a catalogue level and never a compatibility claim.

### 2.2 `Parts` tab — one row per physical part

| Column | Req | Maps to | Notes |
|---|---|---|---|
| Vehicle label | ✅ | `Listing.donorVehicleId` | Dropdown of the labels the seller entered on `Vehicles`. |
| What the part is | ✅ | staff input to `Part` | Free text, the seller's own words. |
| Category | ✅ | `Part.categoryId` | Dropdown of **leaf** Categories + `Other / not listed` (#3). |
| Category description | — | — | Free text — required only when Category = `Other / not listed`. |
| Visible codes / numbers | — | `PartNumber` (staff) | Any numbers the seller can read off the part. |
| Condition | ✅ | `Listing.condition` | Dropdown: `New` / `Used – Good` / `Needs Repair` (Q7 fixed enum). |
| Condition notes | — | `Listing.conditionNotes` | Free text. |
| Known defects | — | `ListingDefect` rows | Free text, **one fault per line** — Staff split into rows. |
| Price (EUR) | ✅ | `Listing.priceEur` | The seller's price. Copied **unchanged** (§3). |
| Negotiable | — | `Listing.negotiable` | Yes / No. Haggling happens in Messages; there are no formal offers (#8). |
| Removal notes | — | `Listing.removalNotes` | Part-specific provenance detail ("removed with bracket"). |
| Seller SKU | — | `Listing.sellerSku` | Optional. |
| Dimensions / weight | — | `Listing.length/width/height/weightKg` | Optional — help Staff quote shipping later (#10). |
| Photo files | ✅ | `ListingPhoto` | Filenames in the photo folder for this part (≥ 1). |

### 2.3 Reference tabs (hidden, dropdown-backed)

`Makes`, `Models`, `Generations`, `Categories`. These drive the data-validation dropdowns
so the seller selects rather than types catalogue values.

**Their contents are not finalised by this ticket.** The exact `Generation` list and the
exact leaf `Category` list come from the **Seed data plan** (map — *Not yet specified*). This
ticket fixes the sheet's *structure*; the seed-data plan fills the lists, and Staff refresh
the reference tabs whenever they extend the catalogue (§2.4).

### 2.4 Escape hatches — the seller is never blocked

The pilot catalogue is deliberately small (only pilot-donor Generations, #4 / #21). A seller
must never be unable to finish intake because their car or part type is not in a dropdown yet.

- **Vehicle not in the list** → Generation = `— NOT LISTED —`, fill *Not-listed vehicle
  details*, carry on using the seller's own vehicle label on `Parts` rows. During
  transcription Staff **add the `VehicleGeneration` to the catalogue** (and the reference
  tab), then map the row to it. This is the intake-time catalogue growth established in #8
  (the only source of catalogue growth now that #7's fitment-entry path is gone — #21).
- **Category not in the list** → Category = `Other / not listed`, fill *Category
  description*. Staff resolve it to a leaf Category (creating one per the #3 rules if needed).

### 2.5 Photos

- **Transfer:** one folder per donor vehicle — a shared-drive folder or an upload link.
  Messaging apps are acceptable for the smallest sellers, with Staff moving the files into the
  folder.
- **Naming:** `<vehicle-label>_<parts-row-number>_<n>` (e.g. `golf2016_03_1.jpg`) so Staff can
  match a photo to its `Parts` row.
- **Retention:** see §4.

---

## 3. Field responsibility

Principle: **the seller owns their data; Staff are the quality gate, not the data-entry
clerk.** Staff **verify** — they do not re-classify, re-price, or rewrite the seller's copy.

| Data | Seller provides | Staff do |
|---|---|---|
| Donor vehicle | Picks Make / Model / Generation, or flags `— NOT LISTED —` + free text | Map to a real `VehicleGeneration` (extend catalogue if needed); create `DonorVehicle` |
| VIN / mileage / engine / engine code / fuel / transmission / body / drivetrain | Enters what they know (all optional) | Key as-is; VIN displayed masked; engine/fuel/gearbox/drivetrain shown on the Listing (#21) |
| Part type | Free-text name + picks a leaf `Category` (or `Other`) | Confirm / create the `Part` (#5); resolve `Other` to a leaf |
| Part numbers | Types any visible codes | Normalize, match-or-create `PartNumber` + `Part`, set `partStatus` / `pnStatus` (#5) |
| Condition | Picks the enum + writes notes | Check it is honest against the photos; key as-is |
| Defects | Lists **every** fault, one per line | Split into `ListingDefect` rows; check completeness against the photos |
| Photos | Takes and supplies (≥ 1), named per convention | Select, order (first = primary), downscale, upload |
| Price | Sets the price | **Copy unchanged into `priceEur`** — never re-price |

There is **no fitment step** — v1 has no `Fitment` entity (#21). The seller's vehicle pick
yields **provenance only**; buyer discovery is provenance-based and never a compatibility
guarantee.

The seller's condition notes and defect text are shown to buyers **as written** — Staff check
them for honesty and completeness, not style.

---

## 4. Photos and storage cost

Storage cost must scale with **published listings**, not with seller submission volume
(founder-flagged).

- **Only the curated set enters Vercel Blob** — the `ListingPhoto` / `DonorVehiclePhoto`
  records Staff attach during transcription, within the #8 soft cap (~15 per listing).
- **Raw seller photo dumps stay in the shared drive** and are **never migrated** into the
  platform's blob store.
- Staff **downscale on ingest** — cap the longest edge (~2000 px) and re-encode.
- Effective blob footprint ≈ *published listings × ~10 photos*, independent of how many
  photos sellers send or how many submissions are in flight.

---

## 5. What "Staff review" means

There is no `SellerSubmission` record, so a Staff member keys the completed sheet into the
admin tool and reviews **while transcribing**. One combined pass per part:

1. **Publish checklist (#8):** ≥ 1 photo · `condition` set · `priceEur > 0` · `Part` linked
   with a leaf `Category` · `DonorVehicle` linked · ≥ 1 `PartNumber` **or** "no visible
   number" ticked.
2. **Honesty / completeness:** photos support the stated condition; every visible fault is in
   the defect list.
3. **Part work (#5):** match the codes to an existing `Part` or create a provisional one.
4. **Publish**, or hold the part with a note back to the seller.

The seller never touches the application in v1.

---

## 6. Migration path to seller self-entry

The founder wants sellers to self-enter once volume grows. This ticket does **not** decide
that model, but keeps two cheap hedges so the switch is not a rewrite:

- **The §2 column set is the schema for a future seller-facing form.** Keep it current; a
  later form ticket starts from it rather than from scratch.
- **`Listing.status = draft` + the publish checklist already is the approval gate.** A future
  self-serve UI needs only permission to create `draft` `Listing`s and `DonorVehicle` rows;
  everything downstream (checklist, publish) is unchanged. **Do not assume anywhere in the
  build that only Staff create a draft.**

Not decided here: whether self-entry is a restricted role inside the admin tool or a separate
seller listing UI. That is its own future ticket, triggered by the same pressure that would
justify it — Staff transcription load and photo-storage cost rising with seller count.

---

## 7. Staff ops checklist (per submission)

1. Receive the workbook + photo folder into a submission folder on the shared drive; skim for
   completeness.
2. For each `Vehicles` row: match to a `VehicleGeneration` (extend catalogue + reference tab
   if `— NOT LISTED —`); create the `DonorVehicle`, keying engine / engine code / fuel /
   transmission / body / drivetrain as given.
3. For each `Parts` row: match-or-create the `Part` (#5); create the `Listing` against the
   right `DonorVehicle`; set `condition`, `priceEur` (**unchanged**), `removalNotes`,
   dimensions.
4. Split *Known defects* into `ListingDefect` rows.
5. Select, downscale, and upload photos; set the primary.
6. Run the publish checklist (§5); publish or hold with a note to the seller.
7. If the reference tabs changed, send the seller the refreshed template for next time.

---

## 8. Decisions & rationale

| Decision | Why | Rejected |
|---|---|---|
| **No `SellerSubmission` entity; intake is out-of-band, Staff transcribe** | Two Staff, few high-trust sellers, a seeded demo; an intake entity + convert-flow is exactly the deferred self-serve machinery | A `SellerSubmission` table Staff "convert" into listings |
| **One spreadsheet template as the channel** | Tiny seller count, wildly varying sophistication; one good template plus Staff absorbing the messy cases beats a rigid pipeline or a bespoke form now | A guided web form (= self-serve, deferred); fully unstructured intake |
| **Seller fills everything — category, defects, price; Staff review-only** | The seller owns their data; Staff are the quality gate, not conceptually the data-entry clerk | Staff re-classify / re-price / rewrite seller copy |
| **Seller price copied unchanged into `priceEur`** | The seller owns commercial terms; haggling lives in Messages (#8) | Staff set the final price |
| **No fitment step in intake** | v1 has no `Fitment` entity (#21); the seller's vehicle pick is provenance only | A fitment / compatibility column in the sheet |
| **Only the curated photo set enters Vercel Blob** | Decouples storage cost from submission volume (founder-flagged) | Keep every seller-supplied photo in Blob |
| **`— NOT LISTED —` / `Other` escape hatches** | The seller must never be blocked by an incomplete pilot catalogue; Staff extend it during transcription (#8 / #7) | Make the seller wait for a catalogue update before finishing intake |

---

## 9. Related / spun off

- **[#21](https://github.com/Lucy-yunn/test/issues/21) — vehicle-catalogue grain & the
  buyer-facing label** (resolved). Outcome: the catalogue is `VehicleGeneration`-grain over a
  grouped `VehicleModelGroup` level (`Make → Model → Generation → Category`); the funnel's
  third step is labelled **"Generation"**; the `Fitment` entity is **removed from v1** and
  buyer discovery is provenance-only. This doc is amended above accordingly (Generation
  dropdown, `Generations` reference tab, no fitment step, donor engine/fuel/gearbox columns).
- **Seed data plan (map — *Not yet specified*)** populates the reference-tab contents (the
  exact `Generation` and leaf `Category` lists).
