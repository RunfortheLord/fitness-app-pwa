# Code Review Checklist

## Product Correctness

- Does the change match the binding requirements in `docs/PRODUCT_REQUIREMENTS.md`?
- Did the author read the relevant docs before implementation?
- Does the change avoid unrequested scope expansion?
- Does it avoid excluded features: required accounts, realtime multi-device
  cloud sync, AI recommendations, subscriptions, social features, wearables,
  adherence scores, automatic calorie adjustment, and automatic progression?
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
- Are migrations tested from supported prior schemas?
- Are backup schema compatibility and unsupported future versions handled?
- Does migration failure avoid silent data loss?

## Offline Behavior

- Does the app shell remain cacheable and usable offline?
- Are user records stored in IndexedDB rather than service-worker cache?
- Do core flows work without network access after installation?
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
- Are backups kept local and never uploaded by app behavior?
- Are broad error-swallowing blocks avoided?

## Scope Control

- Is the change the smallest coherent change that satisfies the task?
- Are unrelated refactors avoided?
- Are duplicate abstractions avoided?
- Are `any` and unnecessary type assertions avoided?
- Is temporary debug output removed?
- Were reference videos, extracted frames, and contact sheets kept out of Git?
