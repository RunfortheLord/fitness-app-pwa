# Branch review — `feat/nutrition-goals-and-program-library`

Systematic, risk-ordered review of the branch diff vs `main` (241 files, ~45k insertions).
Written incrementally, one pass at a time. Severity: **High** (fix before merge/launch),
**Medium** (fix soon), **Low** (hardening / nice-to-have).

> Scope note: this branch has grown far beyond "nutrition goals + program library."
> It also introduces iOS/Capacitor packaging, Supabase auth + cloud sync, web-push rest
> timers, a public feedback relay, and Gemini meal analysis. Each of those is a meaningful
> surface of its own. Consider splitting future work so a branch this large doesn't land as
> one reviewable unit again.

---

## Pass 1 — New server / public attack surface

Files: `api/feedback.ts`, `api/push/{config,deliver,timer}.ts`,
`src/server/{feedbackApi,webPushTimerApi}.ts`, `src/services/{supabaseClient,authService}.ts`,
`src/hooks/useAuth.ts`.

Overall this code is more careful than typical first-pass server code: QStash HMAC signature
verification on the delivery webhook, https-only endpoint validation (SSRF guard), identifier
allow-listing via regex, bounded string lengths, redaction of the push body, and secrets kept
server-side. Findings below are the exceptions.

### 1.1 — [Medium] Feedback relay lets user input ping the whole Discord/Slack server

`src/server/feedbackApi.ts` → `formatWebhookPayload` interpolates the raw feedback `message`
into the Discord `content` field with no `allowed_mentions`. Discord webhooks parse mentions
by **default**, so a tester (or anyone hitting the public `POST /api/feedback`) can submit a
message containing `@everyone`, `@here`, or `<@&roleId>` and ping your entire server. Same idea
for Slack (`text` triggers `<!channel>`).

- **Fix:** add `allowed_mentions: { parse: [] }` to the Discord payload (and avoid Slack
  broadcast tokens, or set `link_names: false`). Cheap, and it closes the abuse path.

### 1.2 — [Medium] `POST /api/feedback` is unauthenticated with no rate limiting

The endpoint relays every accepted request to your chat webhook. There's no auth, no
per-IP throttle, and no CAPTCHA. Combined with 1.1 this is a spam amplifier: an attacker can
flood your feedback channel and burn Vercel function invocations. Discord's own 30/min webhook
limit caps the downstream, but not the upstream cost or the noise.

- **Fix:** add a lightweight rate limit (e.g. Upstash Ratelimit keyed on IP — you already
  depend on Upstash) and consider a minimal proof-of-work/turnstile before public launch.

### 1.3 — [Low] Origin guard on `POST /api/push/timer` is bypassable by non-browser clients

`api/push/timer.ts` only rejects when the `Origin` / `Sec-Fetch-Site` headers are _present and
wrong_: `(requestOrigin && requestOrigin !== origin)`. A direct client (curl) that sends
neither header passes the check. Impact is limited — the caller must supply a valid push
subscription they already control, so the practical abuse is QStash/Vercel quota consumption,
not user harm — but the guard reads as stronger than it is.

- **Fix:** if you intend this as a real CSRF guard, require `Sec-Fetch-Site: same-origin`
  (treat absent as reject) rather than allowing absent. Otherwise add rate limiting and treat
  it as best-effort.

### 1.4 — [Low / informational] web-push endpoint is an outbound SSRF-shaped primitive

`readHttpsUrl` correctly restricts the push `endpoint` to https, but `webPush.sendNotification`
will still POST an (encrypted) body to any attacker-supplied https URL via the QStash callback.
This is inherent to web-push and low risk (encrypted payload, https only, POST only), but worth
noting if you ever add internal https services reachable from the function's egress.

**Nothing blocking in auth/Supabase:** anon key + VAPID public key are meant to be public;
`useAuth` cleanup is race-safe (subscribes only when still mounted).

---

## Pass 2 — DB schema + migrations (`src/db/database.ts`)

`DATABASE_SCHEMA_VERSION = 14`. Declared version blocks: 1,2,3,4,5,6,**8**,9,10,11,12,**14**.
The upgrade logic itself is sound — v14 backfills run fields with in-place `.modify()` and
`??=` (idempotent), v8 has a row-count guard, snapshots are preserved, and Dexie tolerates the
non-contiguous numbers. Two real concerns:

### 2.1 — [Low — DOWNGRADED after Pass 5] Version 13 was folded into version 14 via the constant-keyed block

> **Correction (Pass 5):** the data-loss risk I first flagged here is **mitigated**.
> `db/database.test.ts` has an explicit test that builds a database at `version(13)` and asserts a
> clean upgrade to the current version (the active-cycle notes backfill), plus a v12→current test
> for the run backfill — all 10 migration tests pass. The run backfill also uses idempotent `??=`,
> so re-running it on a v13 DB that already has those fields is harmless. What remains is a **process**
> concern, not a correctness bug: keying the last block on `this.version(DATABASE_SCHEMA_VERSION)`
> means the v13 upgrade body was absorbed into v14 rather than frozen. It happened to be safe; the
> pattern is still fragile for a future non-idempotent migration. Recommendation (unchanged): stop
> keying the final block on the mutable constant; add an explicit numbered block per change. Original
> analysis retained below for context.

Original concern:
`git log -S "DATABASE_SCHEMA_VERSION = 13"` shows the constant was **13** in `65e868f`
("Expand run tracking and history") and `de622e3` ("Show live workout exercise notes"). There
is no `this.version(13)` block, because the newest block is declared as
`this.version(DATABASE_SCHEMA_VERSION)` (line 824). So when the constant went 13 → 14, that
existing block was **renumbered from 13 to 14 in place** and its `.upgrade()` body was extended —
rather than a fresh `version(14)` being added after a frozen `version(13)`.

Why this matters here specifically: your workflow is continuous deploy after each change
([autonomous-continuous-deploy] memory), so it is very likely a tester's IndexedDB is physically
sitting at Dexie version 13 with v13-era data shapes. On next launch they jump 13 → 14 and Dexie
runs **only** the current v14 upgrade, which is written assuming it transforms a **v12** database.
It happens to be idempotent for the run/notes backfill, so this is probably safe — but it is
untested, and it is exactly the class of gap that corrupts real data silently.

- **Action:** (a) synthesize (or grab) a real v13 database and assert it opens at v14 with run
  fields backfilled and no dropped rows; (b) going forward, **never key the last `.version()` on
  the mutable constant** — add an explicit `this.version(15)` block for the next change and leave
  every prior block frozen forever. The constant should only feed the `appMetadata` stamp.

### 2.2 — [Low] Every historical `.upgrade()` stamps `appMetadata` with the _current_ constant

Each upgrade handler writes `databaseSchemaVersion: DATABASE_SCHEMA_VERSION` (e.g. the v6 handler
writes 14, not 6). The end state is correct because Dexie rolls back on failure, but it means the
persisted schema version is briefly wrong mid-migration and the field can't be trusted as a
per-step marker. Minor; only worth changing if you ever branch logic on it.

### 2.3 — [Advisory] No fixture-based upgrade test harness

`db/database.test.ts` exists (+297 lines) but I have not yet confirmed it exercises real
old→new upgrade paths from serialized fixtures. This is the same durability gap flagged earlier:
before public launch, snapshot a database at each shipped version and assert every upgrade path.
(Deferred to the test-coverage pass.)

---

## Pass 3 — Core invariants (repository boundary, history immutability, template/cycle separation)

Mostly **clean** — this is the strongest part of the branch:

- **Repository boundary holds.** The only direct `db.*` access under `src/pages/` is in `.test.tsx`
  files (setup/assertions). No production page touches Dexie directly.
- **History freeze is correct.** `completeWorkout` copies live workout/exercise/set rows into the
  `workoutHistory*` tables inside one transaction, then deletes the live rows. Snapshots
  (`exerciseSnapshot`, `targetSnapshot`, `workoutSnapshot`) are carried over, not recomputed.
- **Change-appliers respect separation.** `applyChangeToActiveCycle` and `applyChangeToTemplate`
  only _read_ from `workoutHistory*` and _write_ to `activeCycle*` / `template*` tables
  respectively; `both` applies to each independently. Nothing rewrites frozen history. The
  history tables sit in the transaction scope for read-consistency only.
- History editing (`updateWorkoutHistoryNotes/Set/ExerciseNotes`) exists but is the
  spec-sanctioned Milestone 10 "safe edit of notes and recorded performance values," not a
  violation.

### 3.1 — [Medium, verify] `resumeCompletedWorkout` deletes applied-change records without reversing the mutations they made

`resumeCompletedWorkout` (workoutRepository.ts:1199) turns a completed history workout back into
the active workout and, in doing so, deletes both the `detectedWorkoutChanges` and the
`appliedWorkoutChanges` rows for that workout (lines 1245–1252). But the _effects_ of those
applied changes — e.g. a progression weight bump written to `activeCycleWorkoutExercises` /
`templateWorkoutExercises`, or an exercise added to the template — are **not** rolled back. So the
sequence _complete → apply changes to template/cycle → resume_ leaves the program permanently
mutated while erasing the provenance records, and re-completing re-runs detection against the
now-mutated source (changes may silently not re-detect, or double-apply).

- **Failure scenario:** finish a workout where you added a set; apply that change to the template
  (`set_added` → `targetSetCount` bumped); resume the completed workout to fix a typo. The
  template keeps the bumped set count, but there is no longer any record it was applied.
- **Action:** confirm the intended flow. If resume is only meant to be available _before_ the
  change review, guard it: refuse (or reverse) when `appliedWorkoutChanges` exist for the workout.
  If resume-after-apply is intended, it must reverse the applied mutations, not just delete their
  records.

### 3.2 — [Low] `updateWorkoutHistorySet` edits don't re-touch `metricValueSources`

When a history set's `metricValues`/`completed` are edited, `metricValueSources` is left as-is, so
a value manually corrected in history may still be labeled `auto`. Cosmetic; only matters if any
history view renders the source badge.

---

## Pass 4 — Pure domain math (calorie / macro / RIR / replacement)

Reviewed: `goalMacros.ts`, `calorieAdjustment.ts`, `treadmillTracking.ts`, `workoutRirPrefill.ts`,
`exerciseReplacements.ts`. **Math is correct.** Spot-checks that passed:

- **Mifflin-St Jeor** BMR (`10·kg + 6.25·cm − 5·age ± sex`) and TDEE via activity multipliers — correct.
- **Sign conventions are internally consistent** across `calorieAdjustment`: observed vs. desired
  daily calorie deltas, maintenance = intake − observed, goal = maintenance + desired. Cut/bulk
  signs line up. `estimateGoalDate` correctly returns `null` when the rate points away from the goal.
- **Macro allocation** (`computeMacroTargets`): protein from bodyweight, fat = 25% of total but
  capped by calories-after-protein so carbs can't go negative — the reconciliation holds.
- **RIR prefill** keys previous history exercises by `sourcePrescribedExerciseId`, which equals the
  active-cycle exercise id carried on the live workout exercise — the join is correct.

Minor notes (all **Low**):

- **4.1** `calorieAdjustment.summarizeRecentIntake` filters `loggedCalories > 0` to drop unlogged
  days, but this also drops genuine very-low-intake days, biasing `averageLoggedCalories` — and thus
  the estimated maintenance — slightly upward. Acceptable heuristic; document it.
- **4.2** `computeMacroTargets`: at an extreme (e.g. ~450 lb at the 1200 kcal floor) the protein
  floor alone can exceed target calories, so macro calories sum above the target. Unreachable for
  realistic inputs; noting for completeness.
- **4.3** `rankedExerciseReplacements` gates on `current.primaryMuscleGroups` overlap, so a custom
  exercise saved with **no** primary muscle groups gets **zero** replacement suggestions. UX gap,
  not a correctness bug — consider a name/equipment fallback for untagged exercises.
- **4.4** `treadmillTracking` step detection is a hand-tuned accelerometer heuristic
  (thresholds 1.15 / 0.45, 280 ms refractory). Logic is sound (hysteresis + refractory prevents
  double counts) but accuracy can only be validated on-device, not by unit tests.

---

## Summary so far & what's NOT yet reviewed

### Confirmed issues, ranked (updated through Pass 5)

1. **[Medium] 3.1** `resumeCompletedWorkout` erases applied-change records without reversing their
   template/cycle mutations — the only finding that can silently corrupt program state.
2. **[Medium] 1.1** Feedback relay can `@everyone`/broadcast — add `allowed_mentions: { parse: [] }`.
3. **[Medium] 1.2** Public unauthenticated `POST /api/feedback` has no rate limiting (spam/cost).
4. **[Low] 1.3** Origin guard on `/api/push/timer` is bypassable by header-less clients.
5. **[Low] 2.1 (downgraded)** Constant-keyed final migration block absorbed v13 into v14 — safe here
   (idempotent + tested), but change the pattern going forward.
6. **[Low] 1.4 / 2.2 / 3.2 / 4.1–4.4 / 5.1–5.3** as detailed above.

### Green (checked, no issues)

Repository boundary; history freeze on completion; change-appliers' template/cycle separation;
core nutrition/macro/goal math; RIR prefill join; server-side input validation & QStash signature
verification.

### NOT yet reviewed (next passes, in priority order)

- **Pass 5 — Test coverage & the DB upgrade harness.** Confirm `db/database.test.ts` actually
  exercises old→new upgrade paths from fixtures (ties to 2.1/2.3); check that the new behaviors
  (cloud sync, push timer, goals, program library) have the unit/component/e2e coverage
  `TEST_STRATEGY.md` requires. Run `npm run check` and record the result.
- **Pass 6 — Cloud sync & automatic backup** (`cloudSyncService`, `dailyNutritionCloudService`,
  `automaticCloudBackupService`, `db/supabase/schema.sql`): conflict/merge semantics, what leaves
  the device, Supabase Row-Level-Security on the SQL schema, and failure/offline handling.
- **Pass 7 — Gemini meal analysis** (`geminiMealAnalysis*`, `AiMealCameraSubpage`): image handling,
  API-key exposure, prompt-injection of returned data into the food log, cost controls.
- **Pass 8 — Large UI pages** (`NutritionPage` −, `TrainingPage` −, `LiveWorkoutPage` +1361,
  `SettingsPage` +1662, `HistoryPage` +859): state/effect correctness, and the uncommitted
  `useTabSwipeNavigation` / `useKeyboardInset` / gesture hooks.
- **Pass 9 — `programRepository.ts` (+808)** and the built-in library seed integrity
  (`programLibrarySeed.ts`, 6303 lines) + `programWeeks`.

### Process observation

This branch (241 files, ~45k insertions, ~7 distinct feature areas) is too large to review or revert
as a unit. Strongly recommend landing future work in smaller, single-concern branches.

---

## Pass 5 — Test coverage & the DB upgrade harness

**Gate is green on the parts I ran:** `npm run typecheck` passes clean (`tsc -b`, no errors) across
the whole branch, and `src/db/database.test.ts` passes all **10** tests in ~2s.

**Migration harness is genuinely good.** `database.test.ts` builds real old-version Dexie databases
and opens them through `TrainingLogDatabase`, asserting each upgrade. Covered start points: v1, v2,
v3, v6 (×2), v9, v12, **v13**. The v13→current test (line 691) and the v12→current run test
(line 640) are what let me downgrade finding 2.1. This is the fixture-based harness I called for in
2.3 — it largely exists.

Coverage gaps worth closing (all **Low**):

- **5.1** The **v12 `durationWeeks` backfill is untested.** No test starts at a schema where templates
  and cycles lack `durationWeeks` and asserts they receive `DEFAULT_PROGRAM_DURATION_WEEKS` (and that
  cycles inherit their template's length). The v13 run-migration test starts at v12 but only checks
  run fields. Add a v12→current case that asserts `durationWeeks`.
- **5.2** **Stale test title:** the test at line 640 is named "…migrating to **v13**" but it opens the
  current-version database (14) and asserts the run backfill — which now lives in the v14 block. The
  title predates the 13→14 bump and is misleading. Rename to reflect "to current version."
- **5.3** The v13-start fixture (line 694) declares only a **minimal** 4-store schema. Fine for the
  notes backfill under test, but it means "a real v13 DB upgrades cleanly" is only proven for the
  stores it touches. Low, given Dexie only migrates declared stores.

**New features do carry tests.** The diff adds unit/component tests alongside each new surface —
`cloudSyncService.test.ts`, `webPushTimerApi.test.ts`, `feedbackApi.test.ts`, `authService.test.ts`,
`geminiMealAnalysisClient.test.ts`, `calorieAdjustment.test.ts`, `programLibrarySeed.test.ts`,
`nativeRestTimerNotificationService.test.ts`, etc. Breadth looks consistent with TEST_STRATEGY.md;
I have not audited each for depth (deferred to the relevant feature pass). I did **not** run the full
`npm run check` (lint + full unit suite + Playwright e2e + build) — e2e needs a browser and is slow;
recommend running it in CI before merge. Typecheck + the migration suite are the parts I verified.

---

## Pass 6 — Cloud sync & automatic backup

Files: `db/supabase/schema.sql`, `cloudSyncService.ts`, `automaticCloudBackupService.ts`,
`dailyNutritionCloudService.ts`.

**Row-Level Security is correct — the critical multi-tenant property holds.** Both tables
`enable row level security`, grant only to the `authenticated` role (so `anon` can't touch them),
and every select/insert/update policy is scoped to `auth.uid() = user_id`. FKs cascade on
`auth.users` delete. One user cannot read or write another's data. The multi-device overwrite guard
(`canSafelyBackUpAutomatically`) is a genuinely thoughtful design: a device may auto-overwrite the
cloud only if the cloud's current `exportedAt` appears in that device's local backup history, so a
freshly reinstalled/empty device won't clobber the real backup.

### 6.1 — [Medium] Automatic backup uploads the **entire** DB — including GPS run samples — every ~5 min

`automaticCloudBackupService` snapshots on every relevant mutation, debounced to a 5-minute floor,
and `backupService.createJsonBackup` includes `runSamples` (confirmed at backupService.ts:1013).
GPS runs generate a sample every few seconds — thousands of rows per run — so for an active user the
snapshot is multiple MB, re-serialized and re-uploaded **in full** each cycle as one `jsonb` upsert.
`runSamples` is excluded from _triggering_ a backup, but not from the _payload_.

- **Impact:** real mobile-data cost for the user and Supabase egress/storage cost at scale — the
  "one server surface becomes the abuse/cost surface" risk from the earlier warning, now concrete.
- **Options:** exclude `runSamples` (and other high-volume tables) from the cloud snapshot and back
  them up separately/incrementally; gate auto-backup on WiFi/`navigator.connection`; or move to a
  delta sync rather than full-snapshot upsert.

### 6.2 — [Low–Medium] Cloud backups are stored unencrypted server-side

The full snapshot lands in Supabase as plaintext `jsonb`. Anyone with database access (Supabase
staff, a leaked service key, a misconfigured policy) can read every user's complete fitness/nutrition
history. For an app whose pitch is privacy, consider client-side encryption before upload (with a
user-held key), or at minimum disclose in the privacy policy that enabling cloud backup uploads all
data in readable form. This is an expansion of the "local-first, private" positioning that should be
explicit in-app.

### 6.3 — [Low] `markCurrentDeviceSafe` doesn't force an immediate upload

It sets `automaticBackupAllowed = true` and `lastSuccessfulBackupAt = now` but does **not** schedule
a backup, and clears `backupQueued`. So after a user resolves a multi-device block by choosing "use
this device," the cloud still holds the _other_ device's data until the next mutation + interval
(up to 5 min, or never if idle). Verify the calling UI triggers a manual `backupToCloud()` right
after; if not, have `markCurrentDeviceSafe` kick an immediate backup.

### 6.4 — [Low] No DELETE policy/grant on either table

Users can overwrite but never delete their cloud rows through the app. Account deletion cascades from
`auth.users`, but there's no in-app "erase my cloud data." Worth adding for a privacy-forward app
(and for right-to-erasure requests).

### 6.5 — [Low] `daily_nutrition` duplicates data already in the full backup

Per-day logged/target calories are synced to a dedicated table _and_ contained in the full snapshot.
Fine if it powers a specific cross-device query, but it's redundant storage and a second write path
to keep consistent.

---

## Pass 7 — Gemini meal analysis

Files: `services/geminiMealAnalysisClient.ts`, `domain/geminiMealAnalysis.ts` (+ `AiMealCameraSubpage`).

**Design is sound and privacy-respecting.** It's bring-your-own-key: the user's own Gemini key is
sent client→Google directly (`x-goog-api-key`), so the app's own server never sees the key or the
photos. Cost is bounded (`max_output_tokens: 1800`, `temperature: 0.2`, thinking low, `MAX_MEAL_PHOTOS
= 3`, 45s abort timeout) and lands on the user's own quota. **Model output is handled safely:** it's
validated by a `.strict()` Zod schema with bounded string lengths and numeric ranges, turned into a
_draft_ recipe for explicit manual review, and rendered as React text (escaped) — so there's no
injection path from model text into the food log, and a photo containing adversarial text can at
worst produce a wrong estimate the user can reject.

### 7.1 — [Medium, verify] The Gemini API contract is unverifiable by the test suite and looks non-standard

The client POSTs to `https://generativelanguage.googleapis.com/v1beta/interactions` with a body of
`{ model, input: [...], response_format, generation_config: { thinking_level, ... }, store }` and
parses `output_text` or `steps[].type === 'model_output'`. That does **not** match the Gemini
`generateContent` API shape I'm familiar with (`/v1beta/models/{model}:generateContent`, `contents`
/ `parts` / `inline_data`, `candidates[].content.parts[].text`). I can't confirm the mid-2026 API
from here, so treat this as **verify**, not "broken" — but note two things: (a) the client's own
dual-path parsing (try the whole response as the analysis, _then_ fall back to `output_text`, _then_
to `steps`) suggests the author was also unsure of the shape; and (b) `geminiMealAnalysisClient.test.ts`
mocks `fetch`, so **passing tests validate the parser against assumed responses, not the real API.**

- **Action:** run one real call against current Gemini (model id `gemini-3.5-flash`, endpoint, request
  and response shapes) before shipping. If the contract is wrong the feature fails only in production,
  where the mocked tests give false confidence.

### 7.2 — [Low] Disclose that meal photos leave the device

Photos are uploaded to Google for analysis. Consistent with BYOK, but the "local-first/private"
positioning means this should be explicit in-app and in the privacy policy.

### 7.3 — [Low] The user's Gemini key is stored in plaintext (IndexedDB `apiKeyIntegrationSettings`)

Standard for BYOK and same-origin isolated, but an XSS would exfiltrate it. Worth a note; not a
blocker.

---

## Pass 8 — Interaction hooks & large UI pages

I focused on the new interaction hooks (small, self-contained, listener-heavy — the highest
bug-density per line). The five large pages (`NutritionPage` ~2700 lines, `TrainingPage`,
`LiveWorkoutPage` +1361, `SettingsPage` +1662, `HistoryPage` +859) were **not** line-by-line
reviewed — too large for this budget — but they're exercised by the component/e2e suites and the
hooks they depend on are covered here.

Hooks that are **clean**: `useKeyboardInset` (symmetric VisualViewport listener add/remove, restores
the CSS var on cleanup), `useTabSwipeNavigation` (passive listeners, cleaned up; pure testable
`resolveTabSwipeTarget`; correctly yields to dialogs, inputs, and horizontal scrollers),
`useProgramDaySwipe` (React synthetic handlers, no leak, ignores interactive targets).

### 8.1 — [Medium, verify] `useSubpageBackGesture` calls `history.back()` on unmount — navigating away while a sub-page is open can bounce the user

On open the hook does `history.pushState(...)`; its cleanup, when the sub-page didn't exit via a
popstate, runs `window.history.back()` to "consume" that entry. That's right for an in-app close
(`isOpen → false`), but the same cleanup fires on **component unmount**. If a route change unmounts
the page while a sub-page is still open, the pushed entry is no longer the top of the history stack,
so `history.back()` pops the _new_ navigation instead.

- **Failure scenario:** a sub-page is open on `/nutrition`; something navigates to `/training`
  (history: `[…, subpage-entry, /training]`); the page unmounts; cleanup calls `history.back()`,
  popping `/training` and dropping the user back on `/nutrition`.
- **Action:** confirm the UX always closes sub-pages before any programmatic/route navigation (the
  bottom nav is covered while a sub-page is up, which may make this unreachable). If not, the cleanup
  should only `history.back()` when the current entry is still the one it pushed (check
  `history.state.__subpage === depth`).

### 8.2 — [Low–Medium] Module-level `openSubpageDepth` / `suppressNextPop` assume strictly LIFO close order

`useSubpageBackGesture` tracks depth in module-scoped mutable variables shared across all instances.
It's correct as long as sub-pages open and close last-in-first-out. If a _non-top_ sub-page closes
in-app while a deeper one is still open, the decrement desynchronizes `depth` from `openSubpageDepth`,
after which the remaining sub-page's `isTopMost()` is wrong and stops responding to Back. Also fragile
under React StrictMode's double-invoke in dev (double push/back). Consider a small ref-counted stack
of instance ids rather than a bare counter.

### 8.3 — [Low] `useKeyboardInset` can flicker when moving focus between two inputs

`focusout` fires before the next `focusin`, so `document.activeElement` is briefly `body` and the
inset is momentarily reset to `0px` between adjacent fields. Cosmetic; a microtask/`requestAnimationFrame`
debounce would smooth it.

> The large pages remain the biggest un-audited surface. Recommend the interaction-heavy flows
> (live workout set editing, program builder drag/bulk-edit, nutrition sub-page stack) lean on the
> e2e suite, and that `npm run check`'s Playwright run is green before merge.

---

## Pass 9 — Program repository & built-in library integrity

Files: `repositories/programRepository.ts` (seeding + edit guards), `domain/programWeeks.ts`,
`domain/programLibrarySeed.test.ts`. **This area is solid — no findings.**

- **Built-in seeding is idempotent and safe.** `seedBuiltInPrograms` uses fully deterministic IDs
  (`builtin-program:{slug}`, `{templateId}::d{i}`, `{dayId}::e{j}`) and a `builtInSeedVersion` gate,
  so re-running never duplicates and only reseeds when the version advances. On reseed it deletes the
  template's own days/exercises first (so a shorter new definition can't leave orphans) and recreates
  them with the same stable IDs. It only ever writes `builtin-program:*` templates — user templates,
  active cycles, and history are untouched, preserving the template/cycle separation verified in Pass 3.
- **Referential integrity is enforced at runtime.** Each prescription's `exerciseId` is resolved
  against the exercise library during seeding and **throws** if missing, so a dangling reference can't
  seed silently. `programLibrarySeed.test.ts` additionally asserts unique slugs, expected day counts,
  and that every `exerciseId` uses the `builtin:` prefix; `programRepository.builtIns.test.ts` runs the
  real seed, which would fail if any reference didn't resolve. Together that's a strong integrity net.
- **Built-ins are edit-protected.** `assertTemplateEditable` throws on `isBuiltIn` and is called from
  every mutating template operation (edit/day/exercise paths) — built-ins are read-only; changes force
  a duplicate, exactly as intended.
- **`programWeeks` math is correct.** `completionProgramWeek` (check-off-driven week rollover),
  `nextUpDayId`, and `clampProgramDurationWeeks` (1–104, defaults 10) all check out.
- **IP:** built-in program names remain generic (no trademarked branded programs) — confirmed again.

---

## Final status (all 9 passes complete)

**Overall:** a large but generally well-engineered branch. The load-bearing invariants (repository
boundary, workout-history immutability, template/cycle separation, multi-tenant RLS, built-in library
integrity) all hold, the domain math is correct, typecheck is clean, and the migration suite passes.
The issues are concentrated in newer surfaces (feedback relay, cloud-backup scaling, the Gemini API
contract, one sub-page history edge, and the resume-workout gap).

### Fix before merge / launch (Medium)

1. **3.1** `resumeCompletedWorkout` — guard against, or reverse, applied changes on resume (data integrity).
2. **1.1** Feedback relay — add `allowed_mentions: { parse: [] }` (broadcast abuse).
3. **1.2** `POST /api/feedback` — add rate limiting (spam/cost).
4. **6.1** Auto cloud-backup uploads the whole DB incl. GPS samples every ~5 min — exclude high-volume
   tables / gate on WiFi / go incremental (bandwidth + cost at scale).
5. **7.1** Verify the Gemini endpoint/schema against current docs with one real call — mocked tests
   can't prove the contract, and the shape looks non-standard.
6. **8.1** `useSubpageBackGesture` unmount `history.back()` — guard on `history.state.__subpage`, or
   confirm sub-pages always close before navigation.

### Address soon (Low–Medium)

`6.2` unencrypted cloud snapshots + disclosure · `7.2` disclose photo upload · `8.2` module-level
sub-page depth state · `1.3` push-timer origin guard · `2.1` stop keying the last migration block on
the constant.

### Housekeeping (Low)

`2.2` per-step schema stamp · `3.2` history metric-source label · `4.1–4.4` domain heuristics ·
`5.1–5.3` `durationWeeks` test + stale test title · `6.3` `markCurrentDeviceSafe` immediate backup ·
`6.4` no cloud delete · `6.5` `daily_nutrition` redundancy · `7.3` plaintext key · `8.3` keyboard-inset
flicker.

### Not covered (would need dedicated passes)

Line-by-line review of the five large page components; the native iOS/Capacitor wrapper
(`ios/`, `capacitor.config.ts`, `AppDelegate.swift`, native rest-timer notification service); the
full Playwright e2e run; and the food-provider adapter changes (`foodProviderAdapters.ts`,
`foodProviderModels.ts`).
