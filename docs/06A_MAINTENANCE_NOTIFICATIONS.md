# 06A_MAINTENANCE_NOTIFICATIONS

> Version: 0.1

## Goal
Notify early enough to act, not so often they become noise.

## Notification Types

### Mileage
Trigger:
currentMileage >= nextDueMileage - notifyMilesBefore

### Time
Trigger:
currentDate >= nextDueDate - notifyDaysBefore

### Due
Trigger at due mileage/date.

### Overdue
Repeat using configured mileage or day interval.

## Example

Oil Change
- Notify: 500 mi early
- Notify: 250 mi early
- Notify: Due
- Repeat every 500 mi overdue

## User Actions
- View
- Snooze
- Dismiss

## Snooze
- 100 miles
- 7 days
- Custom

## Trigger Engine

MVP:
- Daily Cloud Function
- Recalculate after mileage updates

## Acceptance Criteria
- No duplicate notifications
- Snooze respected
- Mileage and time schedules supported
