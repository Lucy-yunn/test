# ADR-0013 — Direct conversations, and an inbox with folders and grouping

- **Status:** accepted
- **Date:** 2026-09-20
- **Source:** founders' review of steps 11 to 15 · full rules in [`docs/messaging-model.md`](../messaging-model.md) §3.5 and §5
- **Reverses:** "every Thread is triggered by a Listing" and "there is no per-seller conversation" in [`messaging-model.md`](../messaging-model.md) §3.1

## Context

A thread per (listing, buyer) keeps every conversation about one subject, but it left two gaps. A buyer who only wants to ask the seller something general had to pick a part first. And a seller with many threads had one list, newest first, with no way to tell which still need an answer, which to ignore, or that three of them are from the same buyer, who could be sent one parcel, or about the same part, where the buyers can be compared. Buyers also haggle in messages, so the seller needs to see the buyers of one listing side by side.

## Decision

- **A direct conversation** is a Thread with **no listing**: one per (seller, buyer), started by a buyer from **Direct message** at the top of the seller profile's message menu. It is not attached to a listing afterwards; asking about a part starts an ordinary thread from that part.
- **Folders, per side.** A seller has **Unanswered** (the buyer wrote last), **Answered**, and **Trash**. A buyer has **Inbox** and **Trash**. Support messages never count as an answer.
- **Trash is each person's own** and is not visible to the other side. A new message from the other side, or from support, and any message the person sends, takes the thread back out of the trash. Moving to trash marks what was waiting as read.
- **Grouping** on both sides: **Latest** (flat), **By buyer** (a buyer's **By seller**) and **By listing**. Direct conversations form one group at the end of **By listing**.

## Consequences

**Positive**
- The seller can see what needs a reply, drop what does not deserve one without losing it for good, and see one buyer's requests together or every buyer of one part together.
- Buyers can ask a seller a general question, and find their own conversations by seller or by listing.

**Negative / trade-offs**
- `Thread.listingId` becomes nullable, and one direct thread per pair is enforced by a **partial unique index that exists only in the migration** (Prisma cannot express it). Every place that reads a thread's listing handles null.
- Combined shipping and price offers are **not** built. They stay a conversation: orders are still one per listing and cash on delivery, and an offer is free text. Grouping by buyer and by listing is only there to help the seller compare and combine by hand. A structured offer, or a multi-item order, is a later decision.
