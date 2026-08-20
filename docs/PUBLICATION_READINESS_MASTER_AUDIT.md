# Publication Readiness — Master Audit (Publication #11)

> **Read-only reconciliation. Nothing merged, cherry-picked, or deployed.**
> Prepared 2026-08-19 against base commit `6fc03e6` on branch
> `codex/app-store-readiness-rc`. This completes the Publication #11 master-audit
> task that stopped at the token limit. It is a coordination artifact, not legal
> advice, and does not authorize publication. Qualified counsel must review the
> final entity, jurisdictions, product behavior, purchase flow, Privacy Policy,
> and store configuration before any subscription launch.

## 0. How this work was delegated

The `"Draft app terms and conditions"` chat performed a Terms/EULA legal audit,
produced **10 publication blockers**, then (on owner instruction) wrote one prompt
per blocker and launched **11 parallel Codex tasks**: Publication #1–#10 (one per
blocker) plus **#11**, a master auditor told to wait for all ten and reconcile them.
Each task ran in its **own isolated git worktree**, so no task's changes entered
the main branch. Several tasks (#5, #6, #8, and #11 itself) hit the daily usage
limit mid-run.

## 1. Where the work physically lives

All task output is on this machine as **uncommitted working-tree changes** in
Codex worktrees under `C:\Users\adams\.codex\worktrees\`. Every worktree is at
detached `6fc03e6`; **no task reached its "commit only after checks pass" step**,
so **no checks were run and nothing is committed**. `codex/cloud-backup-opt-in`
is a branch label but it also points at `6fc03e6` with the work uncommitted.

| WT                          | Task                                                                                  | Deliverable                                                                                                                                                                                             | Repo change               | Checks         |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------- |
| `26ac`                      | **#2 Entitlements & Trial Engine**                                                    | `domain/entitlements.ts` (+369) & tests (+273), `server/entitlementSession*` (+ route), `api/entitlements/session.ts`, Supabase migration `202608190001_subscription_entitlement_foundation.sql` (+344) | New files, +343 to schema | Not run        |
| `e8a4`                      | **#3 Auth vs Optional Backup**                                                        | Decouples auto-backup from sign-in: `cloudBackupPreferenceRepository`, `useCloudBackupEnabled`, edits across backup/cloud/nutrition services + 8 docs                                                   | 30 files, +530/−86        | Not run        |
| `97e5`                      | **#5 Mandatory Login & Locked Mode**                                                  | `AccessBoundary.tsx` (+475), `accessEligibilityService.ts` (+232), `RestrictedAccessPages.tsx` (+268), `accessControlConfig.ts`, router/AppShell/Settings/backup gating                                 | 14 files, +1,237/−76      | Not run        |
| `8b16`                      | **#6 Age 13+ Compliance**                                                             | `AGE_ELIGIBILITY_AND_MINOR_PRIVACY.md` (+814) + APP_STORE_METADATA/RELEASE_AUDIT edits                                                                                                                  | 3 files, +836             | Not run (docs) |
| `6c05`                      | **#8 Deletion vs Subscription**                                                       | `ACCOUNT_DELETION_AND_SUBSCRIPTION_AUDIT.md` (+585) + PublicInformationPages copy/tests, metadata/audit edits                                                                                           | 5 files, +667/−29         | Not run        |
| `50ee`                      | **#9 Privacy & Health Data**                                                          | `docs/legal/PRIVACY_POLICY_DRAFT.md` (+512), `docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY_DRAFT.md` (+312)                                                                                           | 2 new docs                | N/A (docs)     |
| `30d9`                      | **#10 Terms, EULA & Counsel**                                                         | `docs/TERMS_OF_USE_WORKING_DRAFT.md` (+1,142)                                                                                                                                                           | 1 new doc                 | N/A (docs)     |
| `0100`,`5614`,`8a35`,`8cb0` | **#1 Entity/LLC · #4 Subscription Value · #7 Territories/Auto-Renewal · #11 Auditor** | Research memos delivered **in-chat only** — no repo edits                                                                                                                                               | Clean worktrees           | N/A            |

## 2. Master matrix

| Task                  | Outcome                                                                                                                                                                                                                                                                    | Files / location                             | Merge dependency                         | Unresolved blocker                                           | Next action                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| #1 Entity/LLC         | Memo: form single-member LLC before paid launch; TX specifics ($300, registered agent, franchise report, EIN)                                                                                                                                                              | in-chat                                      | none (owner action)                      | **Owner state of residence/operation**; LLC vs personal      | Owner decides entity; blocks contact fields in #9/#10 |
| #2 Entitlements       | **Strong.** Provider-neutral engine: providers `apple/google_play/web`; statuses `pending/active_paid/grace/on_hold/expired/refunded/revoked`; trial/complimentary/offline-lease; capability gates `legal/auth/billing/account/export/fitness`; Supabase migration + tests | `26ac`                                       | **Foundation — merge first**             | Checks unrun; no provider adapters wired (by design)         | Run checks in worktree; land as base for #5           |
| #3 Cloud opt-in       | Decouples automatic cloud backup from sign-in (backup only after separate opt-in)                                                                                                                                                                                          | `e8a4`                                       | **Prerequisite for #5 & Privacy claims** | Checks unrun; existing-user migration rule                   | Verify, then land before #5                           |
| #4 Subscription value | Memo: model defensible **only if** build delivers operated online services + maintained full-app access (Apple §3.1.2 ongoing-value risk)                                                                                                                                  | in-chat                                      | none                                     | Owner must define ongoing value                              | Owner articulates monthly value                       |
| #5 Locked mode        | Route/state boundary; signed-out/locked users limited to auth/paywall/legal/support/account/export; fail-closed; default-OFF flag; pauses (never deletes) active workout                                                                                                   | `97e5`                                       | **Consumes #2; overlaps #3 heavily**     | Checks unrun; depends on #2 interface + #3 backup decoupling | Rebase onto #2+#3, resolve overlaps, test             |
| #6 Age 13+            | Spec: platform age signals + neutral DOB fallback (retain only band) + guardian path 13–17 + 18+ fallback; flags "checkbox+Terms ≠ compliance"                                                                                                                             | `8b16`                                       | doc-merge only                           | Owner age-flow choice; PB-18                                 | Owner picks age model; feed into #9/#10               |
| #7 Territories        | Memo: CA BPC §17602, IL 815 ILCS 601 auto-renewal disclosure/cancel duties; scope depends on launch territories                                                                                                                                                            | in-chat                                      | none                                     | **Launch territories**                                       | Owner picks territories (rec: US-only first)          |
| #8 Deletion           | State machine: account deletion ≠ store cancellation (Apple/Google); immediate-delete option required; web-billing period-end cancel recommendation; record retention                                                                                                      | `6c05`                                       | doc + small copy edits                   | Web-deletion→cancel policy owner choice                      | Reconcile copy with #5 restricted routes              |
| #9 Privacy & Health   | Two drafts (general + WA/NV consumer-health); marked DO NOT PUBLISH; PB-01 contact, PB-02/18 age, PB-03 implement-first, PB-13 WA/NV applicability                                                                                                                         | `50ee`                                       | doc; depends on #3 truth ("stays local") | Same owner inputs; counsel WA/NV                             | Fill placeholders after entity/territory              |
| #10 Terms/EULA        | Working draft w/ explicit current-vs-target boundary; all `[[PUBLICATION BLOCKER]]` markers intact; not for `/terms` yet                                                                                                                                                   | `30d9`                                       | doc; consumes all owner decisions        | Every open owner input + counsel                             | Finalize after decisions + counsel                    |
| #11 Auditor           | **This document**                                                                                                                                                                                                                                                          | `docs/PUBLICATION_READINESS_MASTER_AUDIT.md` | —                                        | —                                                            | Owner reviews & directs integration                   |

## 3. Conflicts & overlapping changes

Same file touched by multiple worktrees — must be reconciled, not blind-merged:

| File                                         | Tasks      | Nature                                                                        |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `src/pages/PublicInformationPages.tsx`       | #3, #5, #8 | 3-way: restricted-route copy (#5), backup wording (#3), deletion warning (#8) |
| `docs/APP_STORE_METADATA.md`                 | #3, #6, #8 | 3-way doc: backup, age rating, deletion metadata                              |
| `src/components/AppShell.tsx`                | #3, #5     | Sign-in→backup default (#3) vs access gate (#5)                               |
| `src/services/backupService.ts`              | #3, #5     | Backup opt-in (#3) vs export-without-mutation gate (#5)                       |
| `src/services/dailyNutritionCloudService.ts` | #3, #5     | Same seam                                                                     |
| `src/pages/SettingsPage.tsx`                 | #3, #5     | Backup toggle (#3) vs locked settings (#5)                                    |
| `src/pages/PublicInformationPages.test.tsx`  | #3, #8     | Test edits collide                                                            |
| `docs/RELEASE_AUDIT.md`                      | #6, #8     | Doc append collide                                                            |

**Conceptual conflict (most important):** #3 and #5 both assume the _other's_
change. #5's Privacy/UX story ("sign-in doesn't upload data") is only true once
#3 lands; #3's backup toggle must live behind #5's locked-settings rule. They
must integrate together, on top of #2's entitlement types.

## 4. Overclaim check (Publication instruction #4)

**Pass.** No task claims Apple/Google/Stripe billing is live. #2's migration and
engine are explicitly provider-neutral with **no adapters wired**; #3/#5 gate
behind a **default-OFF** flag; #9/#10 drafts are conspicuously marked
current-vs-target with `DO NOT PUBLISH` / `[[PUBLICATION BLOCKER]]`. The
current release remains local-first, optional-auth, free, no subscription.

## 5. Dependency-ordered integration plan

Do **not** land as-is. Recommended order, each step gated by `npm run check`:

1. **#2 Entitlements** (`26ac`) — all new files, no overlap. Land first as the
   entitlement-state foundation. Wire it to nothing yet.
2. **#3 Cloud opt-in** (`e8a4`) — decouple auto-backup from sign-in. Add the
   existing-user migration rule. This is a **real product-behavior change** and
   needs its own review (it alters a current default).
3. **#5 Locked mode** (`97e5`) — rebase onto #2+#3, resolve AppShell / backup /
   dailyNutrition / SettingsPage / PublicInformationPages overlaps, keep the flag
   **default-OFF** so current users aren't locked out against a backend that
   doesn't exist yet.
4. **#8 Deletion copy** (`6c05`) — reconcile PublicInformationPages against #5's
   restricted routes; land doc audit.
5. **Docs #6, #9, #10** — land as internal drafts (not `/terms`, not `/privacy`).
   Merge APP_STORE_METADATA / RELEASE_AUDIT edits by hand (3-way / 2-way).
6. Keep **#1/#4/#7** memos as decision inputs; nothing to merge.

Everything after step 1 stays behind the default-OFF access flag until billing,
store config, and counsel are done.

## 6. Deduplicated owner decisions still needed

1. **Entity:** form an LLC (rec: yes, single-member, before recurring billing) or
   proceed personally — and **your state of residence/operation** (blocks #1, and
   the contact fields in #9/#10). Do **not** put a home address / personal phone
   in published docs.
2. **Territories:** launch scope (rec: **US-only first**) → sets #7 state-law set.
3. **Age model:** confirm 13+ and choose the flow — platform signal + DOB
   fallback + guardian 13–17, or 18+ fallback (#6).
4. **Ongoing subscription value:** what continuing service justifies monthly
   (Apple §3.1.2) without promising an update cadence you can't keep (#4).
5. **Trial start event:** at auth success, or at explicit "Start free trial" after
   assent (rec: the latter) (#2/#10).
6. **Purchase during trial:** charge immediately, or defer paid start to trial end.
7. **Cross-platform entitlement:** does one purchase unlock all platforms?
8. **Web deletion → cancel:** should account deletion cancel a Stripe sub at
   period end? (rec: yes, with warning) — Apple/Google stay store-managed (#8).
9. **Existing users:** everyone gets the 14-day trial on first auth, or grandfather?
10. **Complimentary grants:** may a "permanent" grant be revoked (fraud/error/abuse)?
11. **Disputes:** governing law/venue; court vs arbitration (+ opt-out / small
    claims). **No arbitration or class waiver will be inserted without this.**
12. **EULA choice:** Apple Standard EULA + service Terms, or custom EULA.
13. **Ops confirmations:** OpenAI ZDR/abuse-monitoring setting; feedback
    destination (Slack/Discord/none); Web Push/QStash at launch; "Vigorune" name
    clearance; content/IP ownership.

## 7. Publication verdict (separate tracks)

**Current release (local-first, free, optional auth):** **CONDITIONALLY READY —
pending counsel.** The app itself is largely intact and all subscription work is
quarantined. The gating items to publish _with Terms_ are: (a) no `/terms` route
or affirmative clickwrap assent exists, (b) public support contact is a
placeholder, (c) Privacy disclosure gaps (feedback destination, push/QStash,
consumer-health rights), (d) entity/contact fields, and (e) counsel review. It is
**not** "publish-immediately, legally-airtight" as originally hoped — no Terms can
be that — but the path is short.

**Subscription target (mandatory auth, 14-day no-card trial, $2/mo auto-renew):**
**NOT READY.** Nothing is implemented or committed; no billing SDKs, no store
products, no server entitlement live; entity unformed; territories, age flow,
governing law, and ongoing-value story unresolved. The engineering foundation
(#2/#3/#5) is promising but unmerged and unchecked, and the legal drafts (#9/#10)
are explicitly `DO NOT PUBLISH`. This track becomes **READY FOR COUNSEL/STORE
REVIEW** only after Section 5 integration passes checks, the Section 6 decisions
are made, provider/store configuration is real, and qualified counsel signs off.

_Never represented as legally risk-free or publishable without qualified counsel._

---

## Update — 2026-08-19 (later): workstreams executed & globalized

Owner decisions since the audit: **personal (no LLC), Texas, WORLDWIDE distribution,
Apple IAP + Google Play Billing only at launch (Stripe/web deferred), 18+ launch**
(see `docs/DECISIONS.md`, 2026-08-19). Ten Codex tasks' stalled work was continued
and reconciled via six follow-up worktrees; then the legal docs were re-generalized
from the initial US-only/13+ assumption to worldwide/18+.

### Deliverables now in this repo (docs-only, all marked DO NOT PUBLISH / draft)

- `docs/TERMS_OF_USE_WORKING_DRAFT.md` — worldwide, 18+, store-only billing; Part A current-release / Part B subscription rider / Apple-Google compliance maps.
- `docs/legal/PRIVACY_POLICY_DRAFT.md` — + full EEA/UK GDPR layer (Art. 9 explicit consent, Art. 6 basis table, DSR, transfers) over the US layer (FTC HBNR, WA/NV).
- `docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY_DRAFT.md` — WA MHMD / NV SB370.
- `docs/ACCOUNT_DELETION_AND_SUBSCRIPTION_AUDIT.md` — provider-aware deletion/cancellation state machine (Apple/Google management routes; web deferred).
- `docs/AGE_ELIGIBILITY_AND_MINOR_PRIVACY.md` — 18+ launch; full 13+/guardian design kept as a labeled FUTURE appendix.

### Not yet integrated (held for owner approval)

- **Code branch `worktree-agent-a57a4c255a4a2c770` (head `def47d7`)** — entitlement engine (#2) + sign-in/backup decoupling (#3) + locked-mode (#5), behind a **default-OFF** `VITE_ACCESS_CONTROL_ENABLED` flag. **Checks green: typecheck/lint/build pass, tests 973/973.** Merging needs a small `PublicInformationPages.tsx` + `docs/APP_STORE_METADATA.md` reconciliation. Awaiting owner go.
- Globalized `APP_STORE_METADATA.md` / `RELEASE_AUDIT.md` edits (in branch `a04a0f51`) deferred to that same merge step to avoid a double conflict.

### Blocker register (net, after globalization)

- **Closed by decision:** territories (worldwide), age floor (18+ → COPPA/GDPR-Art.8/TASAA-SCOPE/UK-AADC off the launch surface), EULA path (Apple Standard EULA + service Terms), billing model (store-only).
- **Newly opened by worldwide:** **published geographic trader address** (now required by EU/UK distance-selling law, not just Apple) — most load-bearing; **EU + UK Art. 27 representatives** (paid appointments, or geofence out EEA/UK); **processor DPAs + SCC/IDTA transfer mechanism**; confirmation that store purchase flows capture EU/UK withdrawal-right consent + easy-cancellation.
- **Still open:** dispute forum (TX court vs arbitration), venue county, ongoing-subscription-value statement (Apple §3.1.2). **Deferred (not launch):** all Stripe/web-billing + 13–17 minor items.

### Verdict (updated)

- **Current free release:** CONDITIONALLY READY pending counsel — plus a `/terms` route + clickwrap (the code branch adds this) and the address/contact items.
- **Subscription target (worldwide, 18+, store-only):** NOT READY — becomes READY FOR COUNSEL/STORE REVIEW only after: code branch merged + billing adapters implemented + Apple/Google products configured; trader address + EU/UK representatives secured; DPAs signed; counsel review. The engineering foundation is done and green; the gating work is now legal-entity/representative/store-config, not core code.

_Never represented as legally risk-free or publishable without qualified counsel._
