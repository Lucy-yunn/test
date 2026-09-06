# Used Auto Parts Marketplace

A Part-centric marketplace for used automotive parts. Bulgaria-based operation, English UI
with a language toggle. Buyers find parts by funnelling from their vehicle; sellers are
onboarded white-glove and their listings are entered by staff. This file is the glossary — the
canonical vocabulary for the domain. It holds no implementation detail; the entity model lives
in [`docs/domain-model.md`](./docs/domain-model.md).

## Language

### People and access

**User**:
The login identity for anyone who can sign in — a buyer, a seller, or staff. Carries the role.
_Avoid_: account, member, login

**Role**:
What a User is: `buyer`, `seller`, or `staff`. Exactly one per User in v1.
_Avoid_: permission, type, group

**Buyer**:
A party who browses and purchases parts. The profile is created automatically when a person
self-registers on the site.
_Avoid_: customer, client, shopper, user

**Seller**:
A party whose parts are sold on the platform. The record is created by staff during
onboarding; a login is attached later, or never.
_Avoid_: vendor, supplier, dismantler, merchant, yard, partner

**Staff**:
The operator role — the founders — who run the admin tool. Staff has no profile of its own,
only the role.
_Avoid_: admin (for the person), operator, moderator, superuser

**Location**:
A Seller's single physical place of business. One Seller has one Location in v1.
_Avoid_: address, branch, warehouse, site

**Seller center**:
The read-only area where a Seller with a login views their own Orders and product
performance. Listing is never done here.
_Avoid_: seller dashboard, seller portal, vendor console

**Admin tool**:
The back-office where Staff manage listings and orders. "Admin" is acceptable only as the
name of this tool, never as a word for a person.
_Avoid_: admin panel, CMS, control panel, backend

### Catalogue

**Group**:
A display-only cluster of Categories, shown as one heading in the funnel's final step
(Lighting, Brakes, Engine). Around 13 of them, frozen. Never attached to a Part.
_Avoid_: section, department, family, parent category, supercategory

**Category**:
A leaf part type that a Part is classified under (Headlight, Alternator, Brake caliper). Only
the leaf — plus one "Other / not listed" catch-all — is selectable and attaches to a Part.
_Avoid_: part type, subcategory, classification, kind

**Part**:
The platform's canonical technical identity of a component, independent of any physical item.
One Part has many Listings. Compatibility and part numbers live here, never on the Listing.
_Avoid_: product, article, SKU, component, item

**PartNumber**:
One of the manufacturer or aftermarket numbers a Part is known by. A Part has zero or more; a
Part with none is still valid and listable.
_Avoid_: OEM number (as the only term), SKU, code, reference

**Attributes**:
The category-specific technical properties of a Part (a headlight's side and lighting
technology, a caliper's piston count), held as validated JSON keyed by the Part's Category.
_Avoid_: specs, properties, metadata, fields

### Vehicles

**VehicleMake**:
A car manufacturer in the reference catalogue (Volkswagen, BMW).
_Avoid_: brand, marque, manufacturer

**VehicleModel**:
A model line under a Make (Golf, 3 Series).
_Avoid_: series, nameplate

**Modification**:
A specific engine/body variant of a Model — engine and engine code, fuel, power, body style,
production date range, and an optional generation label. The leaf of the vehicle catalogue and
the funnel's third step. Hand-built in v1, covering only the pilot sellers' donor vehicles.
_Avoid_: variant, trim, type, version, spec, generation, engine, KType

**Fitment**:
The set of Modifications a Part is verified compatible with. Lives on the Part. Manually
entered and staff-verified only — never inferred from a donor vehicle.
_Avoid_: compatibility, fits, applications, cross-reference, linkage

**Funnel**:
The buyer's only search path in v1: Make → Model → Modification → Category, resolving to the
Listings of compatible Parts. Stopping partway shows a list to continue from.
_Avoid_: search, filter, finder, wizard

### Selling and buying

**DonorVehicle**:
The physical car a Seller dismantled, from which one or more Listings' parts were removed.
Entered once by staff and always identified down to a Modification; its parts are then added
as Listings against it.
_Avoid_: donor car (as the entity name), source vehicle, scrap car, parts car, vehicle

**Provenance**:
Which DonorVehicle a physical part came from — the Listing's link to its DonorVehicle. Kept
strictly separate from Fitment.
_Avoid_: source, origin, history, donor (on its own), pedigree

**Listing**:
One physical used item a single Seller has for sale. Always tied to one Part and one
DonorVehicle. A single unique unit — never a quantity.
_Avoid_: ad, item, product, offer, SKU, inventory, stock

**Condition**:
The fixed grade of a Listing's item: New / Used – Good / Needs Repair. Plus free-text notes
and required photos.
_Avoid_: grade, quality, state, rating

**Known defect**:
One specific fault or missing element of a Listing's item, disclosed as its own entry so the
buyer sees a bulleted list. Distinct from the free-text condition notes.
_Avoid_: fault, issue, flaw, damage note

**Order**:
A Buyer's purchase of exactly one Listing, moving through a fixed lifecycle
(placed → confirmed → shipped → delivered, or cancelled). No payment in v1.
_Avoid_: transaction, purchase, sale, checkout, cart

**Cancellation request**:
A Buyer's request to cancel an Order before it ships. Carries a reason. Always ends in
approval — by the Seller, by Staff, or automatically after seven days; it is never rejected
and the Buyer cannot withdraw it.
_Avoid_: cancellation (as the action), refund request, return, dispute

**Favorite**:
A Buyer's saved reference to a Listing. Feeds the seller-center favourites count.
_Avoid_: wishlist, bookmark, like, save, watch

**Thread**:
A single buyer↔seller conversation, scoped to one Listing and one Buyer. Started from a
listing page.
_Avoid_: conversation, chat, inbox, ticket

**Message**:
One entry in a Thread.
_Avoid_: DM, note, chat, post
