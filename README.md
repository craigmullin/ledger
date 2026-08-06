# Ledger

Ledger is your vehicle's memory: a private maintenance record for services,
repairs, mileage, costs, receipts, and the details worth keeping.

The product mark is **M.L**. The implementation follows the approved product,
domain, Firebase, and UI specifications under [`docs/`](docs/).

## Local setup

Requirements:

- Node.js 22+
- npm 10+
- Firebase CLI 15+

Install and start the app:

```bash
npm install
npm run dev
```

The checked-in web configuration connects to the dedicated `ledger-f9abc`
Firebase project. Firebase web configuration is a public client identifier;
security is enforced by Authentication, Firestore rules, and Storage rules.
Environment variables may override the defaults for emulator or staging use.

## Firebase

The repository contains:

- Firebase Hosting SPA configuration
- ownership-scoped Firestore rules
- private per-user Storage rules
- required initial Firestore indexes
- optional Auth, Firestore, Storage, and Hosting emulator ports

The repository is bound to `ledger-f9abc`. Deploy with:

```bash
firebase deploy
```

Do not change `.firebaserc` to another product's Firebase project.

## Commands

- `npm run dev` — local development
- `npm run build` — type-check and create the production build
- `npm run preview` — serve the production build locally
- `npm test` — run automated tests

## Current scope

Sprint 0 includes authentication, My Garage, vehicle creation, vehicle overview,
timeline, entry creation, linked mileage history, and ownership-scoped Firebase
configuration. Sprint 1 adds receipt upload, photos, expanded costs, mileage
tools, and reports.
