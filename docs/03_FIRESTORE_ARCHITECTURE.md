# Firestore Architecture

**Version:** 0.1  
**Status:** MVP specification

## Goals

- keep user and household data private
- support fast vehicle timeline queries
- preserve source and confirmation metadata
- avoid deeply nested structures that are difficult to query or migrate
- allow AI processing without granting the client direct access to secrets

## Ownership model

Every user-owned document must include one of:

- `ownerUserId`
- `householdId`

MVP recommendation: begin with `ownerUserId`. Introduce households only when shared garages are implemented.

## Collections

```text
users/{userId}
vehicles/{vehicleId}
serviceEntries/{serviceEntryId}
serviceOperations/{operationId}
odometerReadings/{readingId}
attachments/{attachmentId}
parts/{partId}
serviceEntryParts/{serviceEntryPartId}
maintenanceDefinitions/{definitionId}
reminders/{reminderId}
aiReviews/{reviewId}
```

Top-level collections are preferred for flexible filtering, exports, migrations, and administrative tooling.

## Common fields

All mutable documents should include:

```ts
{
  ownerUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}
```

Use server timestamps for authoritative creation and update times.

## Vehicle document

```ts
interface VehicleDocument {
  ownerUserId: string;
  nickname?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  licensePlate?: string;
  licenseState?: string;
  status: 'active' | 'sold' | 'totaled' | 'archived';
  heroAttachmentId?: string;
  latestMileage?: number;
  latestMileageDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: 1;
}
```

`latestMileage` is a denormalized convenience value. The historical source of truth remains `odometerReadings`.

## Service entry document

```ts
interface ServiceEntryDocument {
  ownerUserId: string;
  vehicleId: string;
  description: string;
  title?: string;
  serviceDate: Timestamp;
  mileage?: number;
  category?: string;
  providerType?: 'diy' | 'shop' | 'dealer' | 'other';
  providerName?: string;
  totalCostCents?: number;
  partsCostCents?: number;
  laborCostCents?: number;
  notes?: string;
  nextDueDate?: Timestamp;
  nextDueMileage?: number;
  aiReviewStatus: 'not_requested' | 'pending' | 'reviewed' | 'dismissed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: 1;
}
```

Store money as integer cents. Do not store floating-point currency.

## Odometer reading document

```ts
interface OdometerReadingDocument {
  ownerUserId: string;
  vehicleId: string;
  readingDate: Timestamp;
  mileage: number;
  source: 'manual' | 'service_entry' | 'receipt' | 'obd' | 'import';
  serviceEntryId?: string;
  attachmentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: 1;
}
```

## Attachment metadata

Binary content belongs in Cloud Storage. Firestore stores metadata only.

```ts
interface AttachmentDocument {
  ownerUserId: string;
  vehicleId?: string;
  ownerType: 'vehicle' | 'service_entry' | 'incident' | 'part' | 'tool';
  ownerId: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  documentType: 'receipt' | 'estimate' | 'insurance' | 'registration' | 'title' | 'photo' | 'manual' | 'other';
  uploadStatus: 'pending' | 'complete' | 'failed';
  extractionStatus: 'not_requested' | 'pending' | 'complete' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: 1;
}
```

## AI review document

Keep generated output separate from confirmed domain records.

```ts
interface AiReviewDocument {
  ownerUserId: string;
  vehicleId: string;
  serviceEntryId: string;
  model: string;
  promptVersion: string;
  status: 'pending' | 'complete' | 'failed';
  suggestions: AiSuggestion[];
  createdAt: Timestamp;
  completedAt?: Timestamp;
  schemaVersion: 1;
}
```

Each suggestion should have a stable ID, type, proposed value, confidence label, explanation, and disposition.

## Required indexes

Initial composite indexes likely include:

- `serviceEntries`: `ownerUserId ASC, vehicleId ASC, serviceDate DESC`
- `odometerReadings`: `ownerUserId ASC, vehicleId ASC, readingDate DESC`
- `reminders`: `ownerUserId ASC, status ASC, dueDate ASC`
- `attachments`: `ownerUserId ASC, ownerType ASC, ownerId ASC, createdAt DESC`

Add indexes from observed query needs rather than speculating broadly.

## Security rules

Client access requires authentication and matching ownership.

Conceptually:

```text
allow read, create, update, delete:
  if request.auth != null
  && resource.data.ownerUserId == request.auth.uid
```

Create rules must validate `request.resource.data.ownerUserId == request.auth.uid`.

Storage paths should include the user ID:

```text
users/{userId}/vehicles/{vehicleId}/attachments/{attachmentId}/{fileName}
```

Never authorize access based only on a client-provided vehicle ID.

## Backend functions

Use callable or authenticated HTTPS functions for:

- AI review
- document extraction
- export generation
- future external data imports

API keys and model credentials must never be shipped to the client.

## Transactions and consistency

Use a transaction or trusted backend operation when:

- saving an entry and creating its odometer reading
- updating `vehicle.latestMileage`
- accepting an AI suggestion that creates related records
- deleting an entry with generated dependent records

Attachment upload can be eventually consistent and must not block entry creation.

## Deletion

Prefer soft archive for vehicles. Service entry deletion may be hard delete after confirmation, but related attachments, readings, operations, and reviews must be handled explicitly.

A future account-deletion job must remove Firestore records and Storage objects.

## Acceptance criteria

- All user records are ownership-scoped.
- Vehicle timeline queries require one indexed query.
- AI output is stored separately from confirmed data.
- Money uses integer cents.
- Mileage history is preserved.
- Attachment failures cannot corrupt service entries.
- Secrets are used only in trusted backend code.
