# Research: v1 category taxonomy

Resolves [issue #3](https://github.com/Lucy-yunn/test/issues/3). Part of the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

**Question.** What category taxonomy should v1 ship? Survey RRR.lt / Ovoko and ProxyParts,
note TecDoc "generic article" numbering, propose a concrete v1 list scoped to pilot Bulgarian
dismantling-yard / mechanic stock, decide depth and naming, decide standardised-scheme mapping
now vs later, and give a rule for how the taxonomy extends.

**Scope guardrails from the map.** Catalog model is `Category → Part → Listing`; Fitment on Part,
Provenance on Listing. Buyer search is a funnel `brand → model → year → part category`, and the
category is the **last** step, so it must be navigable by a non-expert buyer. MVP is a functional
demo with seed data; Bulgaria first; solo builder + Claude Code, so keep it lean.

Date of investigation: 2026-09-05.

---

## Sources

All primary sources retrieved live on 2026-09-05.

| # | Source | Type | What it gave us |
|---|--------|------|-----------------|
| S1 | `rrr.lt/en/parts-list` and category pages (e.g. `/en/parts-list/brake-system--kpt5`) | Primary — live site of the market leader (Ovoko, UAB, formerly RRR) | Their real top-level category set and the flattened category→subcategory→part-type menu |
| S2 | `support.ovoko.com` — "Finding the Right Part at RRR.LT" | Primary — first-party help docs | Confirms the browse model: "choose the main category … Many categories are further divided into subcategories", then filter by make/model/year |
| S3 | `proxyparts.com` — part-finder, per-model pages (e.g. `/wiki/part-finder/make/volkswagen/model/golf/`), `/wiki/` | Primary — live site | ProxyParts uses a **flat, highly granular part-name catalogue** with position baked into the name ("Headlight, left"; "Front door 4-door, right"); no browsable category tree — it is a request/matching engine |
| S4 | **TecDoc Data Format, Data Format Version 2.6**, TecAlliance GmbH, doc status 13/12/2021 (`tec-doc-services.com/download/TecDoc-Data-Format_Version_2.6_EN.pdf`) | Primary — the authoritative TecDoc interchange spec | Tables **320 Generic Articles**, **323 Standardised Article Description**, **324 Assembly Groups**, **325 Purpose of Use**, **301/302 hierarchically structured search tree + allocation of GenArt to search structure** |
| S5 | `tecalliance.net/tecdoc-catalogue/`, `/tecdoc-data-supplier/`, TecAlliance blog "TecDoc Non-Spare Parts" | Primary — TecAlliance product/marketing pages | TecDoc classifies products via "generic articles, attributes and criteria … for the entire aftermarket"; "12.8M items of article data", "standardised" |
| S6 | WISEPIM, "Automotive Parts Categories & Taxonomy Rules" | Secondary — PIM vendor guide | Sanity check on modern taxonomy practice: organise by **vehicle system, not brand**; brand is a filterable attribute; example mapping "TecDoc Generic Article 1 = Oil Filter → Engine Parts > Filters > Oil Filters" |
| S7 | Search-surfaced figure: "32 main product groups and 160 sub-categories" for TecDoc | Secondary — **unverified**, could not trace to a TecAlliance page | Rough order of magnitude only |

**Retrieval limitations.** RRR.lt and ProxyParts block server-side fetchers (403 / Cloudflare) for
some paths and render deep pages client-side. RRR's *top-level* categories and its server-rendered
navigation menu (which flattens the whole category tree) were retrievable; individual mid-tree
subcategory pages were not enumerated exhaustively. TecDoc's full generic-article list is behind a
commercial licence — only the data-format spec (S4) and marketing pages (S5) are public.

---

## Findings

### 1. RRR.lt / Ovoko — grouped tree, ~19 top categories, 2–3 levels

RRR.lt (operated by **Ovoko, UAB**; "RRR" and "Ovoko" are the same company and catalogue) exposes
a browse tree. Its **top-level categories** (verbatim, from `S1`):

```
Air conditioning-heating system/radiators
Body/body parts/hook
Brake system
Cabin/interior
Devices/switches/electronic system
Door
Engine
Exterior front body parts
Exterior rear body parts
Front axle
Fuel mixture system
Gas exhaust system
Gearbox/clutch/transmission
Glass
Headlight/headlamp washing/cleaning system
Lighting system
Other parts
Rear axle
Wheels/tires/caps
```

That is **19 top-level buckets**. Each opens into subcategories and then leaf part-types. Examples
pulled from the server-rendered menu on the Brake-system page (`S1`): under body/exterior —
`Front bumper`, `Rear bumper`, `Fenders`, `Engine bonnet/hood`, `Tailgate/trunk/boot lid`,
`Radiator support slam panel`, `Side skirt/arches trim`; under electrical —
`Control units/modules`, `Fuses/fuse boxes`, `Relays`, `Sensors`, `Generator/alternator and its parts`,
`Starter motor and its parts`, `Installation/wiring harness`; under brakes —
`ABS block`, `Brake booster/master cylinder`, `Parking brake/handbrake system`. So the effective
depth is **Category → Subcategory → part-type** (3 levels), but the middle level is thin and
uneven — many subcategories hold only a handful of part-types.

Notable design choices:
- Categories are **vehicle-system oriented** (Brake system, Engine, Front axle), matching `S6`.
- **Front vs rear is split at the top** ("Exterior front body parts" / "Exterior rear body parts";
  "Front axle" / "Rear axle") — because those are genuinely different physical parts.
- **Left/right is *not* in the category** — handing is a filter/attribute, not a category.
- Ovoko's own help text (`S2`) frames the flow as *category first, then narrow by
  make/model/year* — i.e. the mirror image of our funnel, which does vehicle first, category last.

### 2. ProxyParts — flat, ultra-granular part names, no browse tree

ProxyParts (NL; also onderdelenlijn.nl and the `proxyparts.de/.es/.fr/.pl/.se` family) is a
**part-request brokerage**, not a browsable shop. Per-model pages (`S3`) list parts as a **flat set
of specific names with position embedded**:

```
ABS pump · A-pillar cover, left · Bonnet · Dynamo · Engine · Front bumper ·
Front door 4-door, right · Gearbox · Headlight, left · Headlight, right ·
Mechatronic · Rear bumper · Reversing camera · Taillight, left · Throttle body ·
Turbo · Wing mirror, left · Wing mirror, right …
```

There is **no category hierarchy a buyer navigates** — the buyer names the exact part (or picks
from an autocomplete of a few hundred canonical part names) and dismantlers respond. Handing
(left/right) and body-configuration ("4-door") are **part of the name string**, not attributes.
This works for ProxyParts because there is no catalogue to browse; it does **not** fit our funnel,
where the category is a pick-list the buyer scans.

**Takeaway:** ProxyParts validates a *canonical controlled vocabulary of part names* and shows the
failure mode to avoid — if side/config is baked into names, the list doubles/triples in length and
becomes unscannable.

### 3. TecDoc — Assembly Group → Generic Article (GenArtNo) → criteria

From the TecDoc Data Format spec (`S4`), the relevant structure:

- **Table 324 — Assembly Groups.** Each has an "Unambiguous number of the assembly group". This is
  the top classification tier (e.g. Braking System, Engine, Filter, Suspension).
- **Table 320 — Generic Articles.** Each record carries:
  - `GenArtNo` — *"Unambiguous number of the generic article"* / *"Unambiguous number of the
    standardised article description"*, a **stable 5-digit numeric id**. This is the "generic
    article number" the ticket asks about. (`S5`/`S6` example: GenArt for "Oil Filter".)
  - `NormTermNo` → **Table 323 Standardised Article Description** (the normalised name).
  - `AssGrpNo` → the assembly group it belongs to (Table 324).
  - `UsageNo` → **Table 325 Purpose of Use**.
  - Flags: `OK_PC` (passenger car), `OK-CV`, `OK-Eng`, `OK-Axle`, `OK-Universal`, `Delete`
    (earmarked for deletion — **ids are retired, not reused**).
- **Table 327 — Generic Article Synonyms** (multi-language synonym list per GenArt).
- **Tables 301 / 302 — "Hierarchically structured search tree"** and **"Allocation of GenArt to
  Search Structure"**: generic articles are hung on search-tree nodes, and the same GenArt can sit
  under more than one node. So the *browse tree* and the *classification* are separate layers.
- **Tables 328 / 329 / 331 / 332 — criteria**: per-GenArt mandatory and optional attributes
  (e.g. for a headlight: side, bulb type, with/without motor), with formatting constraints.

Order of magnitude: TecDoc covers ~12.8M article records across 1,000+ brands (`S5`); the generic
article vocabulary is in the **low thousands** of entries, grouped under a few dozen assembly
groups (`S7` says "32 product groups / 160 sub-categories" — unverified but the right order).
Licensing the actual data is a **paid TecDoc/TecAlliance subscription**.

**Mapping shape we'd want:** our leaf category ≈ a *cluster of* TecDoc generic articles (our
"Headlight" spans several GenArts — halogen / xenon / LED / with-motor). So a category → GenArt
mapping is **one-to-many**, and it belongs in a nullable array field, filled later.

### 4. What Bulgarian dismantling yards + mechanics actually stock

Pilot sellers strip end-of-life cars and resell every reusable component, plus mechanics'
take-off / surplus parts. High-turnover used inventory, in rough value order: complete engines and
gearboxes; turbochargers, diesel injection pumps and injectors; alternators and starters; A/C
compressors; ECUs and control modules; instrument clusters and infotainment units; headlights,
tail lights, mirrors; bumpers, bonnets, tailgates, doors, wings; airbags and seatbelt
pretensioners; steering racks, control arms, wheel hubs, shock absorbers, subframes; driveshafts
and differentials; radiators and intercoolers; catalytic converters and DPFs; alloy wheels;
seats, dashboards, steering wheels. Consumables and wear items (pads, filters, belts, bulbs) are
**not** a used-parts business and are out of scope.

---

## Recommendation

### 4.1 Depth — two tiers, but only the leaf is selectable

Ship a **two-level taxonomy**:

- **Group** (≈ 13 of them) — a display-only heading in the funnel's final step. **Not** attached to
  Parts, **not** individually selectable, near-frozen.
- **Category** (≈ 60 leaves) — the selectable unit. `Part.categoryId` points here. This *is* the
  map's "Category" ("general component type — Alternator, Brake Caliper, Headlight, ECU").

Rationale: a strictly flat ~60-item pick-list is too long to scan at the end of the funnel; RRR's
uneven 3-level tree is more nesting than a 60-item catalogue needs and more than seed data can
fill. Groups give a scannable, collapsible menu; a single selectable tier keeps the data model
and the `Category → Part` relation trivial. This also lines up cleanly with TecDoc (Group ≈
assembly group, Category ≈ generic-article cluster).

**Storage:** `Category { id, name, slug, groupId, isSelectable, sortOrder, synonyms text[],
tecdocGenericArticleIds int[] null, deprecatedAt timestamp null }`, with `Group` as a tiny
sibling table (or a self-referential `parentId` + `isSelectable=false` for groups — same thing).
Nothing here needs to change when a real parts-catalogue integration lands later.

### 4.2 The v1 category list

13 groups, ~60 selectable leaf categories. Seed data only needs to populate the ~25–30 most
common; the rest can ship empty.

**Engine**
- Complete engine
- Cylinder head
- Engine block / short block
- Turbocharger
- Engine mount
- Oil sump / oil pump

**Fuel & air**
- Fuel injector
- Diesel injection pump
- Fuel pump / sender
- Throttle body
- Intake manifold
- Mass air flow sensor

**Transmission & drivetrain**
- Manual gearbox
- Automatic gearbox
- Clutch & flywheel
- Driveshaft
- Propshaft
- Differential / transfer case
- Gear selector & linkage

**Exhaust & emissions**
- Catalytic converter
- Diesel particulate filter (DPF)
- EGR valve / cooler
- Exhaust manifold

**Cooling & climate**
- Radiator
- Intercooler
- Cooling fan
- Water pump
- A/C compressor
- A/C condenser
- Heater / blower assembly

**Brakes**
- Brake caliper
- ABS pump / module
- Brake servo & master cylinder

**Suspension & steering**
- Shock absorber / strut
- Coil spring
- Control arm / wishbone
- Wheel hub / bearing
- Steering rack
- Power steering pump
- Subframe / axle beam

**Electrical & electronics**
- Engine control unit (ECU)
- Control module (other)
- Alternator
- Starter motor
- Instrument cluster
- Ignition coil
- Wiring harness
- Infotainment / radio unit

**Lighting**
- Headlight
- Tail light
- Fog light

**Body — exterior**
- Bonnet
- Tailgate / boot lid
- Front bumper
- Rear bumper
- Front wing
- Front door
- Rear door
- Front panel / radiator support
- Grille
- Roof / sunroof panel

**Glass & mirrors**
- Windscreen
- Door glass
- Wing mirror

**Interior & safety**
- Airbag
- Seatbelt & pretensioner
- Airbag control module
- Seat
- Dashboard
- Steering wheel
- Centre console & interior trim

**Wheels**
- Alloy wheel
- Steel wheel

**Other**
- Other / not listed  *(single global catch-all; staff use it when nothing fits, and it is the
  queue reviewed for new categories — see the extension rule)*

That is 13 groups / 61 leaves + 1 catch-all.

### 4.3 Naming conventions

1. **Language:** English, **en-GB** spelling (bonnet, windscreen, wing, tyre, boot). This is the
   used-parts industry norm — RRR/Ovoko and ProxyParts both use it — and matches the "English UI"
   decision. Store a stable `nameKey` so Bulgarian labels can be added later without touching
   slugs.
2. **Case:** Sentence case ("Brake caliper", not "Brake Caliper" or "BRAKE CALIPER").
3. **Number:** **Singular** ("Headlight", "Alternator") — the category names a *type* of component;
   the specific instance is the Part.
4. **No handing, no axle side, no body config in the name.** Left/right, front/rear *axle*
   position, "4-door" etc. are **Part attributes**, surfaced as filters/specs in the results list,
   never as separate categories. *Exception:* where front vs rear denotes a genuinely different
   physical part (front vs rear bumper, front vs rear door, front vs rear wing) keep them as
   separate categories — this matches RRR (`S1`).
5. **No brand, no OE part number, no vehicle** in the name (`S6` — brand is a filter, not a
   category).
6. **Abbreviations** only where every mechanic uses them: ABS, ECU, EGR, DPF, A/C, DPF, CV. Spell
   everything else out.
7. **Slugs:** kebab-case ASCII, derived once, **immutable and never reused**. Renaming a category
   changes `name`/`nameKey` only, not the slug.
8. **`synonyms[]`** per category (free text, multi-language): "alternator" → generator, dynamo,
   генератор. Not shown to buyers in v1 (funnel has no keyword search), but captured now so the
   later search work and any TecDoc reconciliation have the data.

### 4.4 Mapping to a standardised scheme (TecDoc) — **later, but leave the hook now**

**Now:**
- Add the nullable `tecdocGenericArticleIds int[]` column to `Category` and leave it empty (or
  fill only the few unambiguous ones like Alternator, Starter motor, A/C compressor for
  illustration).
- Do **not** license or import TecDoc data for the MVP. It is a paid subscription, the
  generic-article vocabulary is in the low thousands of entries, and a seed-data demo gets nothing
  from it.
- Keep the **structure** TecDoc-compatible: our Group ≈ TecDoc assembly group, our leaf Category ≈
  a cluster of TecDoc generic articles, our `synonyms[]` ≈ TecDoc table 327. So a future mapping is
  additive, one-to-many, and non-destructive.

**Later — trigger:** when the deferred "full European vehicle database / VIN decode / part-number
cross-reference" research ticket (map Q24) is picked up and a real parts-catalogue data source is
integrated. At that point: map each Category → one or more `GenArtNo`; split any Category where
TecDoc draws a distinction that buyers actually filter on (e.g. "Headlight" → halogen / xenon /
LED). The `deprecatedAt` + remap path (below) makes those splits safe.

### 4.5 Rule for how the taxonomy extends

1. **Default to the nearest existing category.** A part that "mostly fits" an existing category
   goes there. "Other / not listed" is the fallback only when nothing fits.
2. **Create a new leaf category only when both hold:** (a) a real listing genuinely does not fit
   any existing category, **and** (b) a non-expert buyer would recognise the name and want to
   filter by it. "A dismantler has one of these" alone is not enough.
3. **A new category needs:** singular en-GB name + `nameKey`, a Group, an immutable slug,
   `synonyms[]`. TecDoc mapping optional.
4. **Only staff/admin add categories.** Never automatic, never seller-driven (sellers don't list
   in v1 anyway).
5. **Never delete a category that has Parts.** Set `deprecatedAt` (hidden from the funnel,
   existing listings still resolve), remap its Parts to the replacement, then retire it. Slugs are
   never reused.
6. **Groups are frozen for v1.** Adding, removing, or renaming a Group is a deliberate taxonomy
   decision recorded in an ADR, not routine maintenance.
7. **Quarterly review** against two signals: (a) funnel sessions that reached the category step and
   returned zero results, and (b) the volume and content of the "Other / not listed" bucket. If a
   cluster of similar parts accumulates in "Other" or a broad category, promote it to its own
   category. If a category has had no listing for 12 months, consider merging it back.

---

## Open questions / decisions for the founder

1. **Leaf granularity — coarse now vs fine now.** The list above is deliberately **coarse**: one
   "Headlight", one "Airbag", one "Seat". A buyer may have to open two or three listings to find
   the exact variant (mitigated by showing Part attributes — side, xenon/halogen, etc. — in the
   results list). The alternative is splitting the ~10 highest-variance categories now (Headlight,
   Tail light, Airbag, Seat, Door, Wing mirror…), which roughly doubles their entries and adds
   upfront modelling work. **Recommendation: coarse now, split later via the extension rule.**
   Founder should confirm she is comfortable with buyers doing a little variant-picking in the
   results list in exchange for a shorter category menu.
2. **en-GB vs en-US spelling.** Recommendation is en-GB (bonnet / windscreen / wing / boot),
   matching RRR and ProxyParts. This is user-facing and, because slugs are immutable, awkward to
   change later. Founder should give an explicit yes/no.
3. **Two-tier vs strictly flat.** Recommendation keeps a display-only **Group** layer so the
   funnel's last step is a scannable ~13-heading menu rather than a ~60-row scroll. If the founder
   prefers the absolute simplest data model, a flat list with no groups is viable — at a real UX
   cost at the end of the funnel. (Prototype ticket #9 can A/B this.)
4. **Confirm the pilot vehicle/stock list.** This taxonomy is scoped to *typical* Bulgarian
   dismantler stock. Once the hand-curated vehicle list (map Q24) and the seed-data plan are
   settled, walk the actual pilot inventory against these 61 categories and prune any that no
   pilot seller can fill, add any recurring part they stock that is missing.
