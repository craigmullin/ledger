# Ledger Domain Model

## Product principle

Ledger records what happened, preserves the evidence, and helps determine what happens next.

The domain model may be rich, but the user experience must remain lightweight. Most fields are optional, inferred, extracted, or added later.

## MVP entities

### Vehicle

Stable identity and configuration.

- `id`
- `nickname`
- `year`
- `make`
- `model`
- `trim` (optional)
- `vin` (optional)
- `licensePlate` (optional)
- `currentMileage` (derived from latest odometer reading)
- `status`: `active | sold | totaled | archived`
- `createdAt`
- `updatedAt`

### ServiceEntry

The central record for maintenance and repair history.

Required or defaulted:

- `id`
- `vehicleId`
- `description`
- `serviceDate` (defaults to today)
- `createdAt`
- `updatedAt`

Strongly encouraged:

- `mileage`

Optional:

- `category`: `maintenance | repair | inspection | diagnosis | tires | registration | incident | other`
- `providerType`: `diy | shop | dealer | other`
- `providerId`
- `totalCost`
- `laborCost`
- `partsCost`
- `notes`
- `nextDueDate`
- `nextDueMileage`
- `aiReviewStatus`: `not_requested | pending | reviewed | dismissed`

A single entry may contain several operations, such as an oil change, tire rotation, and brake inspection performed during one visit.

### ServiceOperation

Optional structured detail associated with a ServiceEntry.

- `id`
- `serviceEntryId`
- `name`
- `system`: free text initially; controlled vocabulary later
- `result` (optional)
- `laborHours` (optional)
- `shopEstimate` (optional)

### OdometerReading

Mileage is historical, never merely overwritten.

- `id`
- `vehicleId`
- `readingDate`
- `mileage`
- `source`: `manual | service_entry | receipt | obd | import`
- `serviceEntryId` (optional)

### Attachment

Generic private attachment that may belong to a vehicle, service entry, incident, part, tool, or provider.

- `id`
- `ownerType`
- `ownerId`
- `storagePath`
- `fileName`
- `mediaType`
- `documentType`: `receipt | estimate | insurance | registration | title | photo | manual | other`
- `uploadedAt`
- `extractionStatus`: `not_requested | pending | complete | failed`

Do not create separate storage models for each feature.

### Part

Reusable part identity.

- `id`
- `manufacturer` (optional)
- `partNumber` (optional)
- `description`
- `category` (optional)
- `sourceUrl` (optional)

### ServiceEntryPart

- `serviceEntryId`
- `partId`
- `quantity`
- `unitCost` (optional)
- `installedMileage` (optional)
- `warrantyEndDate` (optional)

### MaintenanceDefinition

A manufacturer, owner-defined, or AI-suggested maintenance interval.

- `id`
- `vehicleId` or vehicle compatibility key
- `name`
- `intervalMiles` (optional)
- `intervalMonths` (optional)
- `scheduleType`: `manufacturer | owner | suggested`
- `sourceId` (required for manufacturer claims)
- `enabled`

### Reminder

- `id`
- `vehicleId`
- `relatedType`
- `relatedId`
- `title`
- `dueDate` (optional)
- `dueMileage` (optional)
- `status`: `open | completed | dismissed`

At least one of `dueDate` or `dueMileage` is required.

## Later entities

These should not block the MVP:

- `ServiceProvider`
- `Vendor`
- `InventoryItem` and `InventoryTransaction`
- `Tool` and `ServiceEntryTool`
- `Incident`
- `DiagnosticRecord`
- `Procedure`
- `VehicleSpecification`
- `ReferenceResource`
- `Tire` and tire-position history
- `Warranty`
- `Expense`

## Source and confidence model

Any imported, extracted, or generated value should support:

- `origin`: `user | document | manufacturer | vendor | ai`
- `sourceId` or source URL when applicable
- `confidence`: `confirmed | likely | uncertain`
- `confirmedByUserAt` (optional)

AI output must never overwrite user-confirmed data silently.

## Recommended Firestore shape

Prefer top-level collections with explicit foreign keys for query flexibility:

```text
vehicles/{vehicleId}
serviceEntries/{serviceEntryId}
serviceOperations/{operationId}
odometerReadings/{readingId}
attachments/{attachmentId}
parts/{partId}
serviceEntryParts/{id}
maintenanceDefinitions/{id}
reminders/{id}
aiReviews/{reviewId}
```

Security rules must scope every record to an owning user or household identifier.

## Non-goals for initial implementation

- automatic diagnosis
- automatic purchasing
- unsourced torque specifications
- direct OBD integration
- complete manufacturer data ingestion
- autonomous changes to maintenance records
