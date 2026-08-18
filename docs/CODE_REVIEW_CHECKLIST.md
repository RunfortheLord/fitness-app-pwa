# Code Review Checklist

## Product Correctness

- Does the change match the binding requirements in `docs/PRODUCT_REQUIREMENTS.md`?
- Does it remain inside the frozen boundary in `docs/V1_SCOPE_FREEZE.md`?
- Did the author read the relevant docs before implementation?
- Does the change avoid unrequested scope expansion?
- Does it avoid excluded features: required accounts, realtime multi-device
  cloud sync, AI coaching or automatic AI actions, subscriptions,
  advertisements, social features, wearables, automatic calorie adjustment,
  automatic program advancement, and unrelated expansion?
- If it touches approved optional authentication, snapshot backup, AI meal
  analysis, or store distribution, does it preserve signed-out offline use and
  explicit user review?
- Are unavoidable assumptions recorded in `docs/DECISIONS.md`?

## Data Integrity

- Are explicit domain types used?
- Is IndexedDB access contained behind repository or service abstractions?
- Are multi-record updates transactional?
- Are historical snapshots preserved?
- Do food logs snapshot nutrition values?
- Do template edits avoid mutating active workouts and completed history?
- Are archive rules used instead of unsafe deletes for referenced records?
- Are local dates stored as `YYYY-MM-DD` and timestamps as ISO strings?
- Is timezone handling deliberate?

## Migrations

- Does every schema change include a database migration?
- Are persisted fields kept or migrated rather than silently renamed/deleted?
- Are the bundle/application identifiers, IndexedDB database, local-storage
  keys, persisted IDs, and backup-format identifiers unchanged by public-name
  or store work?
- Are migrations tested from supported prior schemas?
- Are backup schema compatibility and unsupported future versions handled?
- Does migration failure avoid silent data loss?

## Offline Behavior

- Does the app shell remain cacheable and usable offline?
- Are user records stored in IndexedDB rather than service-worker cache?
- Do core flows work without network access after installation?
- Do core flows work without creating or signing into an account?
- Is service-worker update behavior deliberate and recoverable?
- Does active workout state survive reload and restart?

## Accessibility

- Are controls semantic and keyboard/focus accessible?
- Do inputs have labels?
- Are validation and error messages announced or associated with fields?
- Is contrast sufficient in the dark theme?
- Are touch targets at least 44 by 44 CSS pixels?

## iPhone Layout

- Is the design portrait-first?
- Are safe-area insets respected?
- Does the keyboard avoid covering critical inputs or actions?
- Is unwanted iPhone input zoom avoided?
- Is horizontal scrolling avoided in primary screens?
- Do bottom navigation and sticky actions clear the home indicator?

## Tests

- Are unit tests added or updated for domain logic?
- Are component tests added or updated for UI behavior?
- Are integration tests added or updated for persistence and IndexedDB behavior?
- Are end-to-end tests added or updated for major workflows?
- Are empty and populated database states covered?
- Are persistence-after-reload and error paths covered?
- Are migrations tested when applicable?
- Were Chromium and WebKit run where practical?

## Security and Privacy

- Are secrets absent from the diff?
- Is imported JSON validated before writing to IndexedDB?
- Are destructive actions confirmed?
- Do local exports remain local unless the user separately enables the approved
  cloud snapshot feature?
- Are account deletion, cloud-data deletion, and local Clear all data distinct,
  correctly scoped, and confirmed?
- Does optional cloud backup remain a snapshot service with IndexedDB as the
  source of truth?
- Are AI estimates reviewed and explicitly accepted before they can mutate
  local records?
- Are broad error-swallowing blocks avoided?

## Scope Control

- Is the change the smallest coherent change that satisfies the task?
- Are unrelated refactors avoided?
- Are duplicate abstractions avoided?
- Are `any` and unnecessary type assertions avoided?
- Is temporary debug output removed?
- Were reference videos, extracted frames, and contact sheets kept out of Git?
