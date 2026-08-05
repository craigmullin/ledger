# UI Architecture

**Version:** 0.1  
**Status:** MVP specification

## Primary navigation

Ledger opens to **My Garage**.

The core path is:

```text
My Garage -> Vehicle -> Timeline -> Entry
```

Reports, documents, reminders, and settings support this path; they do not replace it.

## Desktop navigation

Use a restrained left sidebar.

- My Garage
- Reminders
- Documents
- Reports
- Settings

When a vehicle is selected, show vehicle-level navigation:

- Overview
- Timeline
- Documents
- Costs
- Details

## Mobile navigation

Use bottom navigation with no more than five destinations:

- Garage
- Reminders
- Add
- Documents
- More

The center Add action creates an entry for the current vehicle. When no vehicle is selected, it prompts for one.

## My Garage

Each vehicle card includes:

- vehicle image or neutral placeholder
- nickname or year/make/model
- latest mileage
- concise status summary
- next relevant reminder
- last entry

Do not use unsupported health scores such as `Healthy` unless the status is based on explicit user-confirmed rules. Prefer factual summaries:

- `Oil change due in 1,250 mi`
- `2 open reminders`
- `Last entry Aug 5`
- `No mileage update in 4 months`

Primary action: **Add vehicle**.

## Vehicle overview

The top of the vehicle page contains:

- vehicle identity
- latest mileage and date
- edit mileage action
- new entry action
- next due item

Below that:

1. open reminders
2. recent timeline entries
3. important documents
4. compact cost summary

Avoid a dense analytics dashboard.

## Timeline

The timeline is reverse chronological by default.

Each item shows:

- date
- entry title or description
- mileage
- cost
- provider type
- attachment count
- reminder or follow-up state

Filters may include:

- maintenance and repairs
- documents
- mileage
- incidents
- reminders

Search should match descriptions, titles, providers, parts, and notes.

## New Entry

The default entry view is defined in `02_SERVICE_ENTRY.md`.

The entry experience should be usable one-handed on mobile, with large targets and camera access near the top of the flow.

## Reminders

The reminder screen groups items by:

- overdue
- due soon
- later
- mileage-dependent but awaiting mileage update

Completing a maintenance reminder should offer to create a related entry rather than merely marking the reminder complete.

## Documents

Documents may be browsed across the garage or within a vehicle.

Common types:

- receipts
- estimates
- insurance cards
- registrations
- titles
- manuals
- photos

Sensitive documents should not display full previews on the Garage screen.

## Reports

MVP reports are intentionally limited:

- spending by vehicle
- spending by year
- DIY versus shop entries
- estimated DIY savings, clearly labeled
- export vehicle history

Reports are secondary navigation.

## Empty states

Empty states must provide one clear action.

Examples:

- Empty garage: `Add your first vehicle`
- Empty timeline: `Record what happened`
- No reminders: `Nothing is currently due`
- No documents: `Add a receipt, registration, or photo`

Do not use decorative empty-state copy that obscures the task.

## Visual system

Approved direction:

- M.L identity
- Playfair Display headings
- Inter interface text
- Ledger Green primary
- orange period and small accents
- warm neutral backgrounds
- comfortable spacing
- elevated cards used sparingly
- line icons
- subtle motion

Typography must remain readable in garage lighting. Decorative display type should not be used for form labels, mileage, costs, or specifications.

## Accessibility

- meet WCAG AA contrast for normal text
- support browser text scaling
- do not use color alone for status
- minimum 44px touch targets
- visible keyboard focus
- accessible labels for icon-only controls
- reduced-motion support

## Responsive priorities

Mobile is the garage-use priority. Desktop supports review, bulk entry, reports, and document organization.

Do not shrink the desktop interface into mobile. Recompose navigation and cards for smaller screens.

## Acceptance criteria

- The first authenticated screen is My Garage.
- A user can reach New Entry from Garage or Vehicle in one action.
- A vehicle's recent history is visible without opening Reports.
- Status language is factual rather than falsely diagnostic.
- Mobile navigation remains at five items or fewer.
- Core tasks are keyboard and screen-reader accessible.
- The interface remains useful without AI elements.
