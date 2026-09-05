# Research: Part identity & OEM part-number model

- **Ticket:** [#5 Part identity & OEM part-number model](https://github.com/Lucy-yunn/test/issues/5)
- **Wayfinder map:** [#1](https://github.com/Lucy-yunn/test/issues/1) — catalog model `Category → Part → Listing`
- **Date:** 2026-09-05
- **Status:** Complete — recommendation ready for founder sign-off
- **Scope note:** Automated part-number supersession is OUT of scope for the build (map, Q). This document recommends the v1 data model *and* the shape that would accommodate supersession later, nothing more.

---

## 1. The question

How is a **Part** keyed and identified?

1. How do OEM part numbers work across major European makes, aftermarket cross-referencing, and supersession chains?
2. How do RRR.lt / Ovoko and TecDoc model "part identity" (the article/part vs. its many numbers)?
3. What happens when the OEM part number is unknown or unreadable on the physical part? (Common for used yard parts.)
4. Can one Part carry multiple part numbers? How are equivalent parts across shared platforms unified into one Part?

---

## 2. TL;DR recommendation

- **Key the Part on an opaque surrogate ID, never on an OEM part number.** Used-yard reality (numbers rubbed off, painted over, never stamped) and supersession both make the OEM PN an unreliable primary key.
- **A Part carries a *set* of part numbers** in a child table (`part_number`), each row typed (`oem` / `aftermarket` / `casting` / `other`), optionally attributed to a brand, and flagged verified/unverified. This is exactly how TecDoc models it (one *article*, many *reference numbers* across manufacturers).
- **The Part row *is* the cross-brand equivalence class.** When staff decide a VW number and an Audi number denote the same component, they attach both numbers to the same Part. No separate "equivalence" entity in v1.
- **Unknown-PN rule:** a Part may exist with **zero** part numbers. Identity then rests on `category` + technical attributes + verified fitment + a staff-facing internal Part code. Staff should try to recover the OEM PN from the donor VIN / OEM catalogue and add it later; adding a number later never changes the Part's identity.
- **Supersession:** do **not** build it for v1. Reserve a `part_number_link` table (documented in §7) so a `supersedes` edge can be added later without migrating the Part model.
- **Duplicate control:** listing intake must search `part_number.normalized` and offer existing Parts before staff create a new one.

---

## 3. Sources and how much to trust them

| Source | Type | Trust | Used for |
|---|---|---|---|
| [TecDoc Data Format spec v2.7 (TecAlliance)](https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf) | Primary — the actual industry data-exchange spec | High | §5 TecDoc model |
| [TecAlliance API docs — Part Linkage Search](https://developer.tecalliance.cn/en/tecdoc-api/function/part-linkage-search/index.html) | Primary — first-party API reference | High | §5 article/linkage fields |
| [Ovoko supply-connector API (OpenAPI)](https://supply-connector.ms.ovoko.com/docs) | Primary — Ovoko's own seller-integration API | High for what it exposes (integration/category mapping); it does **not** publish the full part schema | §6 |
| [Ovoko Ad scraper field reference (piloterr)](https://www.piloterr.com/library/ovoko-ad) | Secondary — third-party scraper documenting the live Ovoko listing payload | Medium — describes real fields, not an official schema | §6 listing fields |
| [Ovoko support: "Finding the right part at RRR.LT"](https://support.ovoko.com/internal-pre-order-articles-en-us/finding-the-right-part-at-rrrlt) / RRR.lt live part page e.g. [`/en/used-part/rpt12750-1296700208-...`](https://rrr.lt/en/used-part/rpt12750-1296700208-mercedes-benz-sl-r129-other-body-part) | First-party UI (page blocked to fetch; URL structure and support text observed via search) | Medium | §6 RRR.lt behaviour |
| [ProxyParts — classification codes](https://www.proxyparts.com/car-parts-stock/classification-codes/) (KZD system, [kzd.info](http://www.kzd.info)) | First-party marketplace UI | Medium | §6 ProxyParts |
| [idpartsblog — "What is a part number supersession?"](https://idpartsblog.com/2024/07/16/what-is-a-part-number-supersession/) | Secondary, vendor blog with concrete OEM examples | Medium | §4.3 supersession behaviour |
| [Systems Online](https://sysonline.com/blog/how-to-manage-parts-supersession-chains), [Motility Software](https://help.motilitysoftware.com/hc/en-us/articles/360060526752-Parts-Supersession-Chain-Succession-Parts) | Secondary — dealer-DMS vendors | Medium | §4.3 supersession as a data structure |
| OEM part-number format guides: [ACTRONICS (VAG)](https://www.actronics.co.uk/news/the-logic-behind-the-vag-oe-numbers-unraveled), [vaglinks PDF](http://www.vaglinks.com/Docs/Catalogues/VAG_Part_Numbers_Explained.pdf), [FCP Euro (BMW)](https://www.fcpeuro.com/blog/understanding-the-madness-or-brilliance-behind-bmws-part-numbering-system), [Adsit (Mercedes)](https://www.adsitco.com/blog/understanding-mercedes-benz-part-numbers/) | Secondary — parts retailers / enthusiast references. **No OEM publishes an authoritative public spec of its own numbering.** | Low–Medium — consistent across independent sources, so directionally reliable | §4.1 |
| [Scrap Car Comparison](https://www.scrapcarcomparison.co.uk/blog/how-to-find-oem-car-part-numbers/), [certified auto recyclers](https://certifiedautorecyclers.com/how-to-find-used-car-parts/) | Secondary — recycler / scrap trade | Medium | §4.4 unknown-PN practice |

---

## 4. Findings: how OEM part numbers actually work

### 4.1 Formats differ per manufacturer group; all are "meaningful" numbers, not opaque IDs

**VAG (VW, Audi, SEAT, Škoda, Porsche, Bentley, Lamborghini, Bugatti)** — one shared system ([ACTRONICS](https://www.actronics.co.uk/news/the-logic-behind-the-vag-oe-numbers-unraveled), [vaglinks PDF](http://www.vaglinks.com/Docs/Catalogues/VAG_Part_Numbers_Explained.pdf)):

- **≥ 9 characters, up to ~14**, in three groups of three plus optional suffixes.
- Group 1 (3): vehicle/engine/platform code (`5K0` = Golf VI, `4B0` = Audi A6 C5). **The same group-1 code recurs across brands on a shared platform** (`7M0` = VW Sharan *and* SEAT Alhambra).
- Group 2 (3): component domain — first digit is the main domain (1 Engine, 2 fuel/exhaust/cooling, 3 gearbox, 4 steering, 5 rear axle, 6 brakes/wheels, 7 pedals/levers, 8 body/interior, 9 electrical, 0 accessories), next two the sub-domain.
- Group 3 (3): the exact part/version.
- **Trailing 1–2 letters** = modification/revision index for a specific application. **Trailing 3-character code** = colour (`Q70` light beige, `U71` flannel grey, `B41` black).
- The letter **O is never used** (to avoid `0`/`O` confusion).

**BMW (also MINI, Rolls-Royce)** ([FCP Euro](https://www.fcpeuro.com/blog/understanding-the-madness-or-brilliance-behind-bmws-part-numbering-system), [EuroCraft](https://eurocraft.us/bmw-part-number-system-i-13)):

- Usually shown as **11 digits**: 2 (main group) + 2 (sub group) + **7 (unique identifier — never shared between two parts)**.
- Optional **index suffix** (e.g. `-12`) marks a revision under the same base number.

**Mercedes-Benz** ([Adsit](https://www.adsitco.com/blog/understanding-mercedes-benz-part-numbers/)):

- **1 letter (usually `A` or `WA`) + 10 digits**: 3 (chassis/design series) + 3 (design group; 01–23 engine, 24–58 chassis/platform, 60–92 body) + 2 (modification/version status) + 2 (part-type within the group).

**PSA / Stellantis** — weakest public information; historically 9–10 digit numeric numbers, migrating toward an "8 + 2" scheme (French car forums; no authoritative source found). Treat PSA numbers as free-form strings.

**Implication for us:** part numbers are semi-structured and brand-specific. Do not try to parse or validate them in v1 beyond **normalisation** (uppercase, strip spaces/dots/dashes). Store the raw string as entered *and* a normalised form for matching.

### 4.2 Aftermarket cross-referencing

The aftermarket (Bosch, Valeo, TRW, etc.) assigns its **own** article numbers and publishes **OE cross-references** — "this Bosch alternator replaces VW `028903029`, Audi `…`". TecDoc is the dominant catalogue that carries these links (§5). A used-parts marketplace consuming this later would ingest: *aftermarket number → set of OE numbers it covers*. For v1 we only need the ability to **tag a Part with aftermarket numbers alongside OE numbers** (same child table, different `number_type`).

### 4.3 Supersession chains

- A **supersession** is the manufacturer replacing an old part number with a new one — for design improvements, supplier changes, standardisation, or parts consolidation ([idpartsblog](https://idpartsblog.com/2024/07/16/what-is-a-part-number-supersession/), [Systems Online](https://sysonline.com/blog/how-to-manage-parts-supersession-chains)).
- Represented as a **directed chain**: `642-188-01-80 → 642-188-04-80 → 642-188-05-80`, the last entry being the only one still sold ([idpartsblog](https://idpartsblog.com/2024/07/16/what-is-a-part-number-supersession/)).
- **Often many-to-one**: several near-identical old numbers collapse into one new number (idpartsblog's VW brake-pad example). So the relation is *not* a clean 1:1 linked list — model it as edges, not as a `previous_number` column.
- **A superseded number is not always a drop-in fit** — sometimes other parts must also change (idpartsblog's VW air-intake example). Supersession therefore informs, but does not by itself prove, interchangeability.
- **TecDoc models this** as table **204 "Superseding Articles"**: rows of `ArtNo supersedes SupersNo`, per-country, with an explicit rule that **cyclic recursion is forbidden** (A→B→C→A not allowed) ([TecDoc Data Format spec](https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf), Table 204).

**For a used-parts yard this matters because the number stamped on the shelf part is frequently an *early* number in a chain.** A buyer searching the current number should still find it. That is the future feature the schema must not block.

### 4.4 When the OEM part number is unknown / unreadable (the used-yard case)

Trade practice for identifying a part with no legible number ([Scrap Car Comparison](https://www.scrapcarcomparison.co.uk/blog/how-to-find-oem-car-part-numbers/), [certified auto recyclers](https://certifiedautorecyclers.com/how-to-find-used-car-parts/), [Ovoko support](https://support.ovoko.com/internal-pre-order-articles-en-us/finding-the-right-part-at-rrrlt)):

1. **Derive it from the donor vehicle.** The donor VIN → the manufacturer's parts catalogue (ETKA, EPC, RealOEM, 7zap) → the OEM number for that component on that exact build. This is the primary method and it is what a white-glove staff operation can realistically do.
2. **Casting / stamping numbers** moulded into the part (engine blocks, brackets, ECUs, calipers) — not the OE number, but a searchable secondary identifier.
3. **Physical evidence**: measurements, photos of connectors, plug count, mounting-point geometry.
4. **Category + vehicle locator databases** (car-part.com model): parts are found by *part type + vehicle*, no number required at all.

**Conclusion: a used part is fully listable and sellable without its own part number.** Marketplaces in this segment (RRR.lt, ProxyParts, car-part.com) are built listing-first precisely because of this. The number, when present, is an *accelerant for search and trust*, not the identity.

---

## 5. Findings: how TecDoc models part identity

Source: [TecDoc Data Format spec v2.7](https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf) (TecAlliance), cross-checked against the [TecAlliance API docs](https://developer.tecalliance.cn/en/tecdoc-api/function/part-linkage-search/index.html).

TecDoc separates **four** concerns that the map's single word "Part" currently blurs:

| TecDoc concept | Table(s) | What it is |
|---|---|---|
| **Generic Article** | 320 (+ 329/331/332/333 for criteria rules) | The **abstract product type** — "Alternator", "Brake caliper, front". Carries the *definition* of which technical **criteria/attributes** are mandatory vs optional for that type. ≈ the map's **Category** (or a leaf below it). |
| **Article** | 200 | **One supplier's specific part**, keyed by `ArtNo` **+ data-supplier number** (`BrandNo`). Has flags such as `Remanufact` (exchange/reman part). This is the row everything else hangs off. ≈ the map's **Part**. |
| **Article criteria / attributes** | 030 / 050 / 210 | The technical data (dimensions, voltage, connector type…) attached to an Article, standardised per Generic Article. |
| **The Article's many numbers** | see below | |

The Article's numbers (spec p.142 lists "OE and competitor References" and "Multiple alternative article numbers" as *basic* article data):

- **Table 203 "Reference Numbers"** — `ArtNo → RefNo`, **each reference tied to a manufacturer** (`ManNo`). The spec: *"References to manufacturers represent OE numbers, provided that the manufacturer has set one of the flags PC, CV, Axle, Engine, Transmission, LCV"* — i.e. the **same table holds OE numbers and competitor/aftermarket numbers**, distinguished by what `ManNo` points to. Per-country include/exclude, a `SortNo` for display order, and a `ReferenceInfo` type code. **One Article routinely has many reference numbers across several vehicle manufacturers** — this is TecDoc's mechanism for unifying shared-platform equivalents under one Article.
- **Table 204 "Superseding Articles"** — supersession edges (§4.3).
- **Table 207 "Trade Numbers"** — short trade/shop codes.
- **Table 209 "GTIN"** — barcode/EAN.
- **Table 205 "Parts Lists"** — groups Articles into sets and "pseudo articles" (display groupings with no orderable number of their own).

Fitment lives separately again:

- **Table 400ff "Article Linkage"** — `Article → vehicle type` (the KType/NType vehicle IDs), with **linkage attributes** (410), country restriction (403), and sort (404). Linkage target types 2 (passenger car) and 16 (commercial vehicle).

**Takeaways for our model:**

1. TecDoc's identity anchor is **an opaque row (`ArtNo`+supplier), not a part number.** Part numbers are all *attributes* of that row — including the OE numbers.
2. **OE numbers and aftermarket numbers share one structure**, differentiated by a type/brand pointer.
3. **Supersession is a separate edge table** with an anti-cycle rule — it is not a mutation of the article.
4. The **abstract type (Generic Article)** owns the attribute *schema*; the concrete Part owns the *values*.
5. Fitment is a **many-to-many link table with its own attributes**, never a field on the Part.

---

## 6. Findings: how RRR.lt / Ovoko and ProxyParts model it

**These are listing-centric marketplaces. There is no evidence of a normalised shared "Part" row above listings.** Parts are clustered for search by *category + codes + fitment*, computed, not stored as a canonical entity.

### RRR.lt / Ovoko

From the [Ovoko Ad payload](https://www.piloterr.com/library/ovoko-ad), the [supply-connector API](https://supply-connector.ms.ovoko.com/docs), and live RRR.lt URLs:

- A listing is keyed by an **internal SKU / ID** (e.g. `rpt12750-1296700208-…` in the URL: `rpt…` = internal part-type code, `1296700208` = an OE code surfaced for search, then donor-vehicle + category slug).
- **`part_number`** — a single "primary" OEM code — **plus `part_numbers[]`**, "an array of deduplicated OEM/manufacturer codes". So **a single item already carries an unbounded flat list of numbers**, no sub-typing.
- **`category.name`** (Ovoko category) — and the supply-connector API's core job is mapping a seller's `third_party_category` → `ovoko_category`, i.e. **category mapping is a first-class integration concern.**
- **`quality`** enum (observed value `USED`), **`status`** (`IN_STOCK`), **`position`** (`FRONT`, `LEFT`…), `warranty` (days), `rhd` flag.
- Seller integration fields include `manufacturer_code` and `additional_codes` as **free-form strings** pulled from the seller's own inventory system.
- Vehicle make/model/year/engine-power/gearbox on the listing = **provenance** (matches the map's Q6 split).

### ProxyParts

- Uses the **KZD classification code** system ([kzd.info](http://www.kzd.info)) to classify part *type* — the equivalent of a category/generic-article code.
- Explicitly **disclaims accuracy** of classification codes ("subject to change… not liable for incorrect classification codes") — a caution that even the big players don't treat these as hard identifiers.
- Search entry points are **engine-code** and **gearbox-code** finders (donor-vehicle-driven), reinforcing §4.4.

**Takeaways:**

1. The incumbents get away with **listing = part-number-bag + category + fitment**, no shared Part row. Our map deliberately goes further (a real Part entity) — that is a **sound choice for a small curated catalogue**, but it means we pay a *matching* cost at intake that RRR.lt does not.
2. **Multiple numbers per item is the norm and is modelled as a plain list**, not a rich structure. We should type them (OE vs aftermarket vs casting) because our staff-entered, low-volume catalogue can afford the extra precision and it pays off for cross-referencing.
3. Category mapping / classification is fuzzy even at scale — keep our category taxonomy (ticket #3) shallow and let the Part's attributes + fitment do the discriminating.

---

## 7. Recommendation: the v1 Part identity model

### 7.1 Entities

```
Category (ticket #3)
   └─< Part            (the reusable technical identity)
          ├─< PartNumber      (0..n — the numbers this Part is known by)
          ├─< Fitment         (0..n — compatible vehicles; ticket #7 owns the detail)
          └─< Listing         (0..n — physical items for sale; ticket #8 owns the detail)
```

### 7.2 `Part`

| Field | Type | Notes |
|---|---|---|
| `id` | surrogate PK (uuid or bigint) | **The identity.** Never derived from a part number. Stable for the life of the Part. |
| `category_id` | FK → Category | Required. |
| `internal_code` | string, unique | Staff-facing short code, e.g. `ALT-000142`. Auto-generated (category prefix + sequence). For back-office UI and printed labels — mirrors RRR's `rpt…` / ProxyParts KZD codes. |
| `name` | string | Human label, e.g. "Alternator 140A, Bosch, EA888 gen3". Staff-authored. |
| `attributes` | JSON (v1) | Technical data (voltage, amperage, connector, dimensions…). Free JSON in v1; graduate to typed criteria-per-category later (TecDoc's Generic-Article-criteria pattern). **See open decision D3.** |
| `pn_status` | enum `has_verified_oem` / `oem_unverified` / `oem_unknown` | Denormalised summary of the PartNumber rows, for list filtering and staff triage. |
| `notes` | text | Free text. |
| `created_by`, `created_at`, `updated_at` | audit | |

### 7.3 `PartNumber` (one Part → many)

| Field | Type | Notes |
|---|---|---|
| `id` | surrogate PK | |
| `part_id` | FK → Part | |
| `raw` | string | Exactly as entered by staff / seller. |
| `normalized` | string, indexed | Uppercased, spaces/dots/dashes stripped. **The match key** for intake de-dup and (later) buyer PN search. |
| `number_type` | enum `oem` / `aftermarket` / `casting` / `trade` / `other` | Mirrors TecDoc's split of reference vs trade numbers, plus `casting` for the used-yard case. |
| `brand` | string, nullable | Free-form make/manufacturer ("VW", "Audi", "Bosch"). **Not** an FK — numbers routinely reference makes outside our curated vehicle list (ticket #4). |
| `is_primary` | bool | At most one per Part. The number shown first / used in listing titles. |
| `verified` | bool | `true` = staff physically read it off a part or confirmed it in an OEM catalogue; `false` = provisional / seller-claimed. Mirrors the map's "manually verified only" stance on fitment. |
| `note` | string, nullable | e.g. "reads 1K0..., last letters illegible". |
| `created_by`, `created_at` | audit | |

**Rules:**

- **A Part may have zero PartNumber rows.** (`pn_status = oem_unknown`.) It is still a valid, listable Part.
- **A Part may have many PartNumber rows**, including several `oem` numbers from different brands. **This is how shared-platform equivalents are unified: one Part, all its equivalent numbers attached.** No separate equivalence entity in v1.
- `normalized` is **not** globally unique — the same number can legitimately appear on more than one Part only if staff have genuinely been unable to merge them; the intake workflow (7.5) exists to keep this rare.

### 7.4 Unknown / unreadable part number — the rule

1. Staff create the Part with `pn_status = oem_unknown` and **no** PartNumber rows. Identity = `internal_code` + `category` + `attributes` + `Fitment`.
2. The Listing (ticket #8) still records what *is* visible on the physical item in its **provenance** (donor make/model/year/engine code, plus any casting number or partial number as free text). Provenance stays on the Listing per the map's Q6.
3. Staff **should** attempt recovery: donor VIN → OEM parts catalogue → OEM number, then add a `PartNumber` row (`number_type=oem`, `verified=true`). A partial/illegible number goes in as `number_type=casting`/`other` with `verified=false` and a `note`.
4. **Adding a number later never changes `Part.id`.** Listings, orders, favourites and messages that already point at the Part are undisturbed.
5. If a Part later turns out to be the same as an existing numbered Part, staff **merge** (7.6).

### 7.5 Intake de-dup workflow (staff)

When staff enter a new listing's part:

1. Enter the code(s) from the part / seller sheet.
2. System normalises each and searches `PartNumber.normalized` **and** does a category+attribute match.
3. Show candidate existing Parts → staff picks one, **or** explicitly chooses "create new Part".
4. On "create new", if a code matched an existing Part but staff still created new, log it for a later merge review.

This is the cost the map's Part-centric model adds over RRR.lt's listing-only model. For a solo builder with staff-entry and seed data it is a **search box + a confirm step**, not a system.

### 7.6 Merge (build only when first needed)

A `merge(source_part, target_part)` operation: repoint `PartNumber`, `Fitment`, `Listing` rows to `target`, then soft-delete `source` with `merged_into = target_id` kept for audit and redirect. Not required for the demo; note it and move on.

### 7.7 Supersession — reserved shape, NOT built for v1

When it is time (post-MVP), add **one** table; the Part model above does not change:

```
PartNumberLink
  from_number_id   FK → PartNumber
  to_number_id     FK → PartNumber
  link_type        enum  supersedes | superseded_by | equivalent
  source           string   (catalogue / staff / TecDoc import)
  created_at
```

- Directed edges, many-to-many (handles the many-old → one-new consolidation from §4.3).
- Enforce **no cycles** (TecDoc Table 204's explicit rule).
- Buyer PN search would then expand: entering the *current* number also matches Parts tagged only with a *superseded* number.
- Until then: if staff know a supersession, they simply attach **both** numbers to the same Part as separate `PartNumber` rows. Good enough for a curated catalogue.

### 7.8 What we are deliberately NOT doing in v1

- No parsing/validation of part-number internal structure (beyond normalisation).
- No Generic-Article-style typed attribute schema per category — free JSON now (D3).
- No automated supersession, no TecDoc/aftermarket catalogue import.
- No global uniqueness constraint on part numbers.
- No cross-reference to aftermarket brand catalogues.
- Buyer-side PN lookup is already out of scope per the map (funnel search only, Q18/Q25) — so `normalized` earns its keep at **intake** in v1, and is ready for buyer search if that scope ever changes.

---

## 8. Decisions the founder must make

| # | Decision | Recommendation |
|---|---|---|
| **D1** | **Effort at intake:** full de-dup workflow (7.5) from day one, or allow Parts to be created freely now and add a merge tool later? | Do the **lightweight search-and-confirm** at intake (7.5). Cheap, and it keeps the seed catalogue clean. Merge tool (7.6) stays deferred. |
| **D2** | **Internal Part code** (`ALT-000142` style) — worth the effort for the back-office, or is the surrogate ID enough? | Yes, add it. Staff and printed labels need something readable; it is a trivial generated field. |
| **D3** | **Technical attributes in v1:** free-form JSON on `Part`, or defer entirely to `notes` text, or build typed per-category attributes now? | **Free JSON.** "Technical data" is part of the map's Part definition so it should exist, but typed criteria-per-category is a real build cost — defer that to a later ticket. Confirm JSON-now is acceptable. |
| **D4** | **`PartNumber.number_type` granularity** — the 5-value enum (oem/aftermarket/casting/trade/other), or just a bare list of strings like Ovoko? | Keep the enum. Low-volume staff entry can afford it and it makes future cross-referencing and supersession import far easier. |
| **D5** | **Merge semantics** when two Parts prove equivalent — hard merge (repoint + delete) or keep both with an alias link? | Hard merge with `merged_into` audit breadcrumb. Simpler mental model; build only when first needed. |
| **D6** | Confirm **supersession stays out of the v1 build** and the `PartNumberLink` shape in 7.7 is an acceptable future home for it. | Confirm. Nothing to build now. |

---

## 9. How this answers the ticket's four questions

1. **OEM numbers / aftermarket / supersession** — §4. Semi-structured, brand-specific, unreliable as keys; aftermarket carries its own numbers + OE cross-refs; supersession is a directed, often many-to-one edge set.
2. **RRR.lt / Ovoko / TecDoc part identity** — §5–6. TecDoc: opaque Article row + many typed reference numbers + separate supersession edges + separate fitment linkage + abstract Generic Article for the attribute schema. RRR.lt/Ovoko: listing-centric, part = number-bag + category + fitment, no shared Part row.
3. **Unknown / unreadable PN** — §4.4 + §7.4. A Part can exist with zero numbers; identity falls back to internal code + category + attributes + fitment; recover the number from the donor VIN later; adding it never changes identity.
4. **Multiple numbers per Part / cross-brand unification** — §7.3. Yes — `PartNumber` is a child collection. The Part row *is* the equivalence class: staff attach every equivalent OE (and aftermarket) number to the one Part.
