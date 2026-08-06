# Current state

Last reviewed: 2026-08-05

## In progress

- Sprint 0 implementation is present on `develop`.
- The application shell, authentication UI, My Garage, Add Vehicle, vehicle
  overview, timeline, and New Entry flow are implemented.
- Entry creation uses a Firestore transaction to preserve mileage history and
  avoid silently regressing latest mileage.
- Firestore and Storage rules scope records and files to the authenticated user.
- A local preview mode is available while Firebase configuration is absent.

## Blocking production setup

- The dedicated `ledger-f9abc` project and Ledger web app are registered and
  the public client configuration is wired into the repository.
- Email/password Authentication is enabled.
- Firestore is live in `nam5`; Cloud Storage is live in `us-east1`.
- Deploy and validate ownership rules against two test users.

## Next

1. Create Firestore and Storage in the approved region and add security-rule
   emulator coverage.
2. Validate Sprint 0 on phone and desktop.
3. Begin Sprint 1 with attachment upload that cannot discard an entry on failure.
