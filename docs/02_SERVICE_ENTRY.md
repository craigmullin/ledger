# Service Entry

**Version:** 0.1  
**Status:** MVP specification

## Goal

Create a useful vehicle record with the least possible effort.

The user-facing object is called an **Entry**. `ServiceEntry` may remain the internal domain name.

## Default interaction

The primary action is **New Entry**.

The first screen asks one question:

> What happened?

Defaulted or inferred:

- vehicle: current vehicle
- date: today
- entry type: unset until chosen or suggested

Strongly encouraged:

- mileage

Optional:

- total cost
- who performed the work
- receipt or photos
- notes

## Minimum valid entry

An entry is valid when it has:

- `vehicleId`
- non-empty `description`
- `serviceDate`

Mileage is encouraged but not required. The UI should explain that mileage improves reminders and history without blocking the save.

## Default form

```text
What happened?
[________________________________]

Date       [Today]
Mileage    [          ] optional
Cost       [$         ] optional
Performed  [Me | Shop | Other] optional

[Add receipt or photos]

[Save Entry]
```

## Progressive details

An **Add details** action may reveal:

- category
- shop or provider
- parts used
- parts and labor cost split
- next due date
- next due mileage
- warranty
- diagnostic codes
- links and references
- private notes

These fields must not appear in the initial form unless product testing proves they are routinely needed.

## Save behavior

Saving the entry must not wait for AI.

1. Validate the minimum fields.
2. Save the user-confirmed record.
3. Create an odometer reading when mileage is present.
4. Begin attachment uploads independently.
5. Offer optional **Review entry** after the record exists.

If AI or uploads fail, the entry remains safely saved.

## AI review

AI review returns suggestions, not edits.

Possible suggestions:

- concise title
- category
- vehicle system
- parts mentioned
- cost details found in attachments
- reminder
- follow-up question
- safety-related verification

Each suggestion supports:

- accept
- edit and accept
- dismiss

Accepting a suggestion records its origin and user confirmation time.

## Example

User entry:

> Replaced rear pads and rotors. Opened the right rear brake hose accidentally, then bled that corner.

Possible review:

- title: `Rear brake pads and rotors replaced`
- category: `repair`
- system: `brakes`
- parts: `rear brake pads`, `rear brake rotors`, `brake fluid`
- follow-up: `Confirm fluid level and inspect the hose connection for leakage`

The review must not claim that bleeding one corner was sufficient or that the vehicle is safe. It may identify the statement and suggest verification.

## Editing

The edit screen displays all confirmed fields. Previously dismissed AI suggestions do not reappear unless review is run again.

Changing mileage updates the linked odometer reading. Deleting an entry should either remove its generated reading or preserve it only after explicit confirmation.

## Timeline presentation

A saved entry displays:

- date
- title or original description
- mileage, when available
- cost, when available
- provider type
- attachment indicator
- reminder indicator

AI-generated titles must be traceable to the original description.

## Offline behavior

A user standing in a garage may have weak connectivity. The entry form should support local draft or queued save behavior. AI review and attachment processing may wait for connectivity.

## Acceptance criteria

- A user can save an entry with only a description.
- Vehicle and date are prefilled.
- Mileage is encouraged but not required.
- The default form has no category requirement.
- The record saves before AI processing.
- AI suggestions require individual approval.
- A failed attachment upload does not discard the entry.
- A typical entry can be recorded in under 30 seconds.

## Deferred

- voice-first entry
- automatic email purchase import
- automatic Amazon import
- labor-time database integration
- automatic shop-price estimates
- background diagnosis
