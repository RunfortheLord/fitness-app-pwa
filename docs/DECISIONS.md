# Decisions

## Architecture and Scope Decisions

- The app is a single-user, local-first Progressive Web App.
- Primary target is iPhone installed through Safari using Add to Home Screen.
- IndexedDB is the source of truth for all primary user records.
- No account, backend, cloud sync, subscription, internet dependency after installation, or external food database is included in the first release.
- JSON is the authoritative full-fidelity backup format.
- CSV is export-only for readable spreadsheet use.
- The UI uses a dark, dense, card-based mobile design adapted from the reference analysis without copying branding or proprietary assets.
- Main navigation is fixed bottom navigation: Home, Nutrition, center Add, Training, History.
- Settings are reachable from the header or a visible secondary action.
- The center Add button opens a context-aware quick-action bottom sheet.

## Product Behavior Decisions

- Nutrition is manual and simple.
- Food log entries snapshot nutrition values at logging time.
- Bodyweight is one manual entry per local calendar date, pounds by default.
- Exercise tracking uses metric-driven presets to allow future expansion.
- Exercises referenced by history or programs should be archived instead of hard deleted.
- Program Templates and Active Program Cycles are separate concepts.
- Activating a template creates an independent active-cycle copy.
- Programs never auto-advance or force a schedule.
- Users manually select workout days.
- Only one active workout is required at a time.
- Active workout state must persist across navigation, refresh, app close, and installed PWA reopen.
- Rest timers are timestamp-based.
- Completing a workout saves history before any optional structural program update.
- Detected structural changes are reviewed individually and are never applied automatically.
- Applying detected changes to active cycle/template/both is transactional.

## First-Release Exclusions

- Account creation and login.
- Backend server and cloud sync.
- Social features and public profiles.
- Subscriptions and ads.
- Wearables and Apple Health.
- AI coaching and AI food-photo analysis.
- External food database and barcode scanner.
- Micronutrients and meal plans.
- Automated calorie adjustment.
- Automated progression and automatic program advancement.
- Estimated 1RM, strength scores, trend weight, adherence percentages, and graphs.
- Public App Store distribution.
- Push-notification dependency.
