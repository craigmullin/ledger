# Ledger MVP

**Version:** 0.1  
**Status:** Implementation plan

## MVP outcome

A user can create a private garage, select a vehicle, record what happened, attach evidence, review the timeline, and see what is due next.

AI review is included only after the non-AI workflow is complete and reliable.

## Release slices

### Slice 0: Foundation

- application shell
- Firebase Authentication
- Firestore configuration
- Cloud Storage configuration
- local development and deployment environments
- ownership-based security rules
- error monitoring
- schema version constants

**Exit criteria:** An authenticated user can open a private empty garage; another user cannot read it.

### Slice 1: Garage and vehicles

- My Garage screen
- add, edit, archive vehicle
- vehicle detail screen
- latest-mileage display
- neutral image placeholder

Minimum vehicle fields:

- year
- make
- model

Optional fields include nickname, trim, VIN, plate, and image.

**Exit criteria:** A user can manage several vehicles and select one reliably on mobile and desktop.

### Slice 2: Entries and timeline

- New Entry flow
- description, date, mileage, cost, provider type
- edit and delete entry
- reverse-chronological vehicle timeline
- create linked odometer reading
- update vehicle latest mileage safely

**Exit criteria:** Ledger is already useful as a private maintenance log without AI.

### Slice 3: Attachments

- camera and file upload
- receipt, estimate, photo, insurance, registration, title, manual, other
- upload progress and retry
- private download/view
- attachment metadata

**Exit criteria:** An upload failure never discards the related entry.

### Slice 4: Reminders

- create reminder from entry or manually
- date-based reminders
- mileage-based reminders
- overdue, due soon, later states
- complete, dismiss, and convert to entry

**Exit criteria:** A user can see what is due next and understand when mileage is too stale to evaluate a reminder.

### Slice 5: Costs and export

- total spending by vehicle and year
- optional parts/labor split
- clearly labeled DIY savings estimate
- printable/shareable vehicle-history export
- structured data export

**Exit criteria:** The user can answer basic ownership-cost questions and take their records elsewhere.

### Slice 6: AI Review Entry

- authenticated backend function
- structured response validation
- AI suggestion review UI
- accept, edit, dismiss
- model and prompt version logging
- AI opt-out
- usage and failure controls

**Exit criteria:** AI failure cannot block entry creation, and no AI suggestion changes confirmed data without approval.

## Recommended initial backlog

1. Establish project stack and deployment decision.
2. Implement auth and ownership rules.
3. Build My Garage empty and populated states.
4. Build Add Vehicle.
5. Build Vehicle Overview.
6. Build New Entry.
7. Build Timeline.
8. Add mileage history.
9. Add attachments.
10. Add reminders.
11. Add basic costs and export.
12. Add AI Review Entry.

## MVP exclusions

Do not include in the first release:

- inventory
- tool tracking
- OBD connectivity
- automatic purchasing
- email or Amazon imports
- manufacturer schedule ingestion
- torque-spec database
- predictive maintenance
- automatic diagnosis
- chat across the full garage
- social or marketplace features

## Definition of done

A slice is done only when it includes:

- loading, empty, success, and error states
- mobile and desktop behavior
- accessibility checks
- security-rule coverage
- basic automated tests
- analytics or logging needed to diagnose failures
- documentation updates

## Product acceptance test

Using a phone, a new user must be able to:

1. sign in
2. add a 2015 Honda CR-V
3. open that vehicle
4. record `Replaced rear brake pads and rotors`
5. add mileage and cost
6. photograph a receipt
7. see the entry in the timeline
8. create a follow-up reminder
9. export the history

This full path must work without AI.

## Stop conditions

Pause new feature work when any of these are unresolved:

- authorization rules allow cross-user access
- entries can be lost during upload or AI failure
- mileage can regress silently
- AI-generated information is displayed as confirmed fact
- the primary entry flow exceeds reasonable garage-use friction
