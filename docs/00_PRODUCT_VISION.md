# Ledger Product Vision

**Version:** 0.1  
**Status:** Approved foundation  
**Audience:** Product, design, engineering

## Design goal

Make maintaining a vehicle feel calm, organized, and rewarding.

Ledger should help people remember, not punish them for forgetting. Recording work must be faster than writing the same information in a notes app.

## Product statement

Ledger is **your vehicle's memory**.

It records what happened, preserves the evidence, organizes the history, and helps the owner decide what should happen next.

Ledger is not an AI chatbot with a maintenance tracker attached. It is a useful vehicle record first. AI reduces typing, organizes information, and offers clearly labeled suggestions.

## North star

When the user walks into the garage, Ledger should already know where they left off.

## Primary experience

1. Open **My Garage**.
2. Select a vehicle.
3. See its current state, upcoming needs, and timeline.
4. Tap **New Entry**.
5. Answer: **What happened?**

The vehicle is the organizing object. The timeline is the heart of the product.

## Product principles

### Record first; organize second; advise third

The basic record must work without AI. AI enhances a useful product; it does not substitute for one.

### The Garage Test

A feature belongs in the MVP only when it is useful while standing beside a vehicle or immediately before or after vehicle work.

### Progressive disclosure

The default entry form remains small. Advanced fields appear only when requested or suggested.

### Facts outrank suggestions

The interface must distinguish:

- user-confirmed facts
- imported or extracted information
- sourced manufacturer information
- AI suggestions and estimates

AI never silently changes confirmed data.

### Source important claims

Torque values, fluid specifications, service intervals, part fitment, recalls, and similar claims require an identifiable source.

### Privacy by default

VINs, registrations, insurance cards, receipts, addresses, and incident records are private unless deliberately shared.

### Exportability

The user owns the record. Vehicle history and attachments must be exportable in useful formats.

## Target users

### Primary

- people who perform some or all of their own maintenance
- households managing several vehicles
- enthusiasts and project-car owners
- owners who want a trustworthy service history

### Secondary

- owners preparing a vehicle for sale
- family members sharing maintenance responsibility
- people comparing estimates or tracking repair costs

## Core jobs to be done

Ledger should answer these questions quickly:

- What did I do last?
- What needs attention next?
- When and at what mileage was this replaced?
- Which parts and fluids did I use?
- How much did I spend?
- How much did I likely save by doing it myself?
- Where is the receipt, estimate, registration, or insurance card?

## MVP scope

The MVP includes:

- authentication and private user data
- My Garage
- add and edit vehicle
- vehicle overview
- chronological vehicle timeline
- simple service entry
- mileage history
- receipt, document, and photo attachments
- reminders by date or mileage
- basic cost totals
- optional AI review of an entry
- exportable vehicle history

## Explicitly deferred

- direct OBD integration
- automatic ordering or purchasing
- inventory and tool management
- full manufacturer-data ingestion
- predictive diagnosis
- marketplace features
- social features
- fleet-management workflows
- unsourced automotive specifications

## AI role

AI may:

- structure free text
- extract receipt or estimate details
- suggest categories, parts, reminders, and follow-up questions
- summarize a vehicle's recorded history
- identify patterns in confirmed records

AI may not:

- alter confirmed records without approval
- present an estimate as a fact
- claim diagnosis certainty
- invent sources or specifications
- conceal uncertainty

## Visual direction

Ledger receives the **M.L** treatment:

- warm neutral surfaces
- Ledger Green primary color
- orange period/accent
- Playfair Display for display typography
- Inter for interface and body text
- comfortable spacing
- left navigation on wider screens
- bottom navigation on mobile
- restrained line icons
- subtle motion

Fraunces is not part of the approved direction.

## Success criteria

The MVP succeeds when:

- a first-time user can add a vehicle and first entry without instruction
- a normal entry can be saved in under 30 seconds
- the user can locate the last related service in under 10 seconds
- AI suggestions are optional, editable, and visibly distinct from facts
- vehicle history remains useful even when AI is disabled

## Product sentence

**Ledger remembers, so you do not have to.**
