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
A person who self-registers to browse, save, message, reserve parts and review sellers. The
profile is created automatically at registration.
_Avoid_: customer, client, shopper, user

**Seller**:
A business, such as a dismantler or repair shop, whose parts are sold on the platform. Staff
create the record at onboarding and provision a login; a seller cannot publish or sell without
one. The seller operates their own Orders.
_Avoid_: vendor, supplier, dismantler, merchant, yard, partner

**Staff**:
The two founders, who run the admin tool. They enter sellers, donor vehicles and Listings on a
seller's behalf, add credits, and hide reviews. Staff are never a party to an Order and cannot
confirm, complete, cancel or refuse one. Staff has no profile of its own, only the role.
_Avoid_: admin (for the person), operator, moderator, superuser

**Location**:
A Seller's single physical place of business. One Seller has one Location in v1.
_Avoid_: address, branch, warehouse, site

**Seller center**:
The area where a Seller runs their Orders, replies to Messages and Reviews, and sees their
Listings, credits and figures. Listing is never done here.
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

**Model Group**:
A buyer-facing grouping of closely-related model designations that share a platform lineage
(`A4, S4`; `A6, S6`; `80, 90`; `100`). The funnel's second step, labelled simply "Model" in
the UI. Performance and badge variants (S4, RS4, GTI) are named within the group, never split
into their own level.
_Avoid_: model line, series, nameplate, submodel, trim

**Generation**:
A generation / platform of a Model Group, identified by its chassis codes and production-date
range — `A4 S4 B5 8D (1994–1999)`. The leaf of the vehicle catalogue and the funnel's third
step. Engine, engine code, fuel, gearbox, power and body style do **not** define it — one
Generation spans all of them. Hand-built in v1, covering only the pilot sellers' donor
vehicles.
_Avoid_: modification, engine variant, trim, type, version, spec, KType

**Funnel**:
The buyer's only search path in v1: Make → Model → Generation → Category, resolving to the
Listings whose donor vehicle matches the chosen Generation. Stopping partway shows a list to
continue from.
_Avoid_: search, filter, finder, wizard

### Selling and buying

**DonorVehicle**:
The physical car a Seller dismantled, from which one or more Listings' parts were removed.
Entered once by staff and always identified to a Generation; its parts are then added as
Listings against it. Carries the structured engine, engine code, fuel, gearbox, body style
and drivetrain of that specific car, and the seller's free-text reason it was scrapped.
_Avoid_: donor car (as the entity name), source vehicle, scrap car, parts car, vehicle

**Provenance**:
Which DonorVehicle a physical part came from — the Listing's link to its DonorVehicle, and the
sole basis of buyer discovery in v1. Provenance is discovery evidence, not a compatibility
guarantee; platform-verified cross-vehicle compatibility is out of scope for v1. Buyers check
part numbers and the donor vehicle's details before purchasing.
_Avoid_: source, origin, history, donor (on its own), pedigree, fitment

**Seller intake sheet**:
The spreadsheet a Seller fills in to hand their inventory to Staff — one workbook per batch,
a row per donor car and a row per part. Staff transcribe it into the admin tool; it is never
stored in the platform. The only Seller-to-Staff handoff in v1.
_Avoid_: submission, intake form, listing form, import, feed

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
A Buyer's reservation of exactly one Listing, moving through placed → confirmed → completed, or
ending cancelled or refused. Only the Seller advances it. Payment is cash on delivery, outside
the platform.
_Avoid_: transaction, purchase, sale, checkout, cart

**Refused**:
The end state of an Order when the Buyer inspected the part at the courier and declined it. Set
by the Seller; the Listing goes back on sale.
_Avoid_: returned, rejected, failed delivery

**Cancellation request**:
A Buyer's record of cancelling an Order before handover, with a reason. Instant while the Order
is placed; once confirmed it waits for the Seller or approves itself after seven days. It is
never rejected, the Buyer cannot withdraw it, and Staff cannot act on it.
_Avoid_: cancellation (as the action), refund request, return, dispute

**Favorite**:
A Buyer's saved Listing, shown as "Saved Parts". Feeds the seller-center favourites count.
_Avoid_: wishlist, bookmark, like, save, watch

**Saved seller**:
A Buyer's saved reference to a Seller, shown as "Saved Sellers".
_Avoid_: follow, subscription, favourite seller

**Review**:
A Buyer's rating of a Seller from 1 to 5 stars with optional text. Any signed-in Buyer may write
one; it is labelled with the purchased part, or "No purchase". The Seller may reply once; Staff
may hide it.
_Avoid_: rating (for the whole), feedback, testimonial

**Credit**:
One unit a Seller spends to publish a Listing. Bought in advance as a Credit bundle, recorded in
an append-only ledger, and never refunded.
_Avoid_: token, coin, point, balance (for one unit)

**Credit bundle**:
A number of Credits sold to Sellers at a fixed EUR price. Bigger bundles cost less per Credit.
Staff record a purchase by hand.
_Avoid_: package, plan, subscription, top-up (for the product)

**Donor-vehicle page**:
The public page for one DonorVehicle: the car's details, why it was scrapped, and every part
taken from it, sold parts greyed last.
_Avoid_: car page, vehicle profile, ID card (informal only)

**Thread**:
A single buyer↔seller conversation, scoped to one Listing and one Buyer. Started by the buyer
from a listing page, and only when both parties have a login. Text only in v1.
_Avoid_: conversation, chat, inbox, ticket

**Message**:
One entry in a Thread. Immutable once sent. Its sender is a buyer, a seller, or Staff (shown
as "IVO Support").
_Avoid_: DM, note, chat, post

**Report**:
A buyer's or seller's flag on a Thread, raising it for Staff to review. Not itself a message.
_Avoid_: flag, complaint, abuse report, ticket

**Notification**:
A durable in-app record that one event (an Order status change, a Cancellation request, a
Review, a low Credit balance) happened, addressed to one recipient — a Buyer or a Seller. Shown in a per-user
feed with an unread count. New-message alerting is not a Notification; it stays on the Thread's
own unread state. There is no notification email in v1.
_Avoid_: alert, message (for this), push, toast, inbox item
