# 06_MAINTENANCE_PLAN

> Version: 0.1

## Design Goal
Make future maintenance obvious without requiring the user to manually track it.

## Terminology
- Maintenance Definition = what (Oil Change)
- Maintenance Schedule = how often (every 5,000 miles)
- Maintenance Status = computed state (Due / Overdue)

## Core Principle
**Timeline records the past. Maintenance Plan calculates the future.**

## UX
Each vehicle owns its own maintenance plan.

Example:

- Oil Change — Every 5,000 miles
- Last: 102,450
- Next: 107,450
- Status: Green

## User Flows

### Add Maintenance Item
Select:
- predefined item
- custom item

Configure:
- intervalMiles (optional)
- intervalMonths (optional)
- priority
- notification preferences

### Auto Reset After Service Entry
After saving a matching service entry:

> Reset Oil Change interval?

YES updates last-done mileage/date.

### Initial Setup
Allow optional:
- lastDoneMileage
- lastDoneDate

## Data Model

### MaintenanceItem
- id
- vehicleId
- name
- category
- priority
- enabled
- createdAt
- updatedAt

### MaintenanceSchedule
- id
- maintenanceItemId
- intervalMiles
- intervalMonths
- notifyMilesBefore[]
- notifyDaysBefore[]
- repeatMilesAfterDue
- repeatDaysAfterDue
- source

### MaintenanceStatus (computed)
- lastDoneMileage
- lastDoneDate
- nextDueMileage
- nextDueDate
- status (green/yellow/orange/red)

## Defaults
Oil Change
Tire Rotation
Engine Air Filter
Cabin Air Filter
Brake Fluid
Coolant
Transmission Fluid
Brakes
Tires
Spark Plugs

## Acceptance Criteria
- CRUD maintenance items
- Miles/time/both supported
- Timeline resets intervals
- Computed status only
