# Storefront & Launch Marketing Copy

> **Purpose.** Ready-to-paste storefront and soft-launch copy for the PWA
> soft-launch (Step 4 of `docs/LAUNCH_PLAN.md`). Written to be reused later for
> the Apple App Store and Google Play listings. This document is copy only — no
> code changes.
>
> **Scope / launch config for this copy.** Free · US-only · no mandatory login ·
> subscription OFF · PWA-first, per `docs/LAUNCH_PLAN.md`. Copy must not promise
> a subscription, price, worldwide availability, or store availability that this
> launch does not ship.
>
> **Companion doc.** `docs/APP_STORE_METADATA.md` holds the App Store Connect
> field table, privacy working-map, and review notes. This file is the
> customer-facing *marketing* copy; do not duplicate the metadata field table
> here. Keep the two consistent (same name, same feature claims, same honesty
> caveats).
>
> **Provisional-name warning.** **"Vigorune" is a temporary working name pending
> naming and trademark review** (`docs/DECISIONS.md`, 2026-08-18;
> `docs/PRODUCT_REQUIREMENTS.md` V1 scope freeze). Every use of the name below is
> a placeholder. Do not file, register, buy paid ads against, or print the name
> until trademark clearance is confirmed. See **What the owner must supply**.

---

## 1. Positioning (the one thing to lead with)

> **A private, local-first fitness tracker. No account, works offline, your data
> stays on your device — and is never sold.**

Everything else (workouts, nutrition, runs, bodyweight, AI meal photos) is a
feature *under* that promise. Lead with privacy + local-first + offline; let the
implicit contrast do the work against bloated, sign-in-walled, data-harvesting
mainstream fitness apps. Never name or disparage a competitor by name.

**Honesty guardrails (apply to every line of copy):**

- It is a **general wellness / fitness-logging tool, not a medical device** and
  not medical, nutrition, or training advice.
- Calorie, macro, maintenance, pace, and AI meal estimates are **estimates**,
  not measurements or clinical guidance.
- "Works offline" and "no account" describe **core features**. Say "optional"
  every time cloud backup, sign-in, barcode lookup, or AI meal photos come up —
  those use the network and, for AI/barcode, third-party providers.
- "Your data stays on your device" is true by default (IndexedDB, on-device).
  Optional cloud backup and optional AI meal analysis send data off-device only
  when the user explicitly turns them on / taps them. Never imply *nothing* ever
  leaves the device.

---

## 2. Candidate taglines (pick one)

1. **Track your training. Keep your data.** *(privacy-first, shortest)*
2. **A full fitness tracker that lives on your phone — no account, works offline.**
3. **Workouts, nutrition, and runs. Private by default, yours to keep.**

Backups / alternates if a shorter or punchier line is wanted:

- "The fitness tracker that doesn't want your data."
- "Log lifts, meals, and miles — all offline, all yours."

---

## 3. Short description (~1 paragraph)

> A private, local-first fitness tracker for workouts, nutrition, bodyweight, and
> runs. Build and follow training programs, log sets with a rest timer, track
> calories and macros, record outdoor and treadmill runs, and watch your
> bodyweight trend — all on your phone. No account required, works offline, and
> your data stays on your device instead of a company's servers. Optional cloud
> backup and AI meal-photo estimates are there when you want them, off until you
> ask.

*(Trim to ~2 sentences for a subtitle/promo slot; the App Store subtitle
"Local-first fitness tracking" already lives in `APP_STORE_METADATA.md`.)*

---

## 4. Long description (App Store / Play length)

> **A fitness tracker that respects your data.**
>
> Most fitness apps make you create an account, stay online, and hand over your
> training and health data. This one doesn't. It's a private, local-first
> tracker: your workouts, meals, runs, and bodyweight live on your device, it
> works offline, and there's no account to create. Just open it and start.
>
> **Train**
> Build your own workout programs or start from a built-in library, then log
> sets during your session with previous-performance context and a
> timestamp-based rest timer that stays accurate after you lock your phone. Your
> completed workout history is saved and read-only, so past sessions stay
> exactly as you did them.
>
> **Eat**
> Log food by day with calorie and macro targets you set yourself. Create custom
> foods, save reusable meals and recipes, and search a food database or scan a
> barcode when you want a quick lookup. Prefer snapping a photo? Optional AI
> meal-photo analysis gives you an editable calorie and macro estimate — you
> review and adjust it, and nothing is logged until you say so.
>
> **Run**
> Track outdoor runs with GPS or treadmill runs by motion, with pace, splits, and
> moving time — or log a run manually. Your routes and location data stay on your
> device.
>
> **See progress**
> Watch your bodyweight trend, calorie history, and strength over time with
> simple, honest charts built only from what you actually logged.
>
> **Your data, your call**
> Everything is stored on your device. Export a full backup or a spreadsheet any
> time. Optional Google or Apple sign-in adds cloud backup if you want a safety
> net — but it's optional, off by default, and core features never require it.
>
> This is a general wellness and fitness-logging tool, not a medical device.
> Calorie, macro, and AI meal estimates are estimates, not medical or nutrition
> advice.

**Feature bullets (for Play's feature list or a "highlights" block):**

- No account required — open and start
- Works offline; your data stays on your device
- Custom and built-in workout programs, live set logging, rest timer
- Read-only saved workout history
- Calorie & macro tracking with custom foods, saved meals, and food/barcode lookup
- Optional AI meal-photo estimates — editable, reviewed before logging
- GPS outdoor runs, motion-sensed treadmill runs, and manual run entry
- Bodyweight trend, calorie history, and strength charts
- Full JSON backup and CSV export
- Optional Google/Apple cloud backup — off by default

---

## 5. Keyword / ASO suggestions

**Guiding ASO principle:** the name is undifferentiated and unsearched, so lead
with the *category + differentiator* ("private", "offline", "local", "no
account") plus the four concrete verticals (workout, nutrition, running,
bodyweight). Don't waste keyword characters on words already in the app title or
subtitle — Apple indexes those separately.

### Apple App Store — `keywords` field (100-char comma list, no spaces)

Draft (fits the 100-char limit; extends the existing `APP_STORE_METADATA.md`
draft, which was `fitness,workout,training,nutrition,bodyweight,running,gym,log`):

```
workout,gym,nutrition,macro,calorie,bodyweight,running,run,offline,private,tracker,log,lifting,strength
```

Rationale:
- **workout / gym / lifting / strength** — highest-volume fitness intent; the
  core use case (programs + live set logging).
- **nutrition / macro / calorie** — the nutrition vertical; "macro" and
  "calorie" are how people actually search food trackers.
- **bodyweight** — both the tracked metric and the training style; dual coverage.
- **running / run** — the GPS/treadmill run vertical; distinct search intent.
- **offline / private** — the differentiator, and low-competition terms that
  privacy-minded users actually type.
- **tracker / log** — category anchors.
- Do **not** repeat the app name, "app", "free", or "best" (wasted characters /
  disallowed). Keep singular+plural collisions out (Apple stems).
- Reassess "private/offline" ranking after launch metrics; swap in
  "diet/meal/exercise" if the nutrition or exercise verticals under-index.

### Google Play — long description keywords (natural language, no keyword field)

Play ranks the long description and title, so weave terms in as real sentences
(already done in §4). Prioritize these phrases naturally, 2–3 mentions max each,
never stuffed:

- primary: *fitness tracker, workout tracker, macro tracker, calorie counter,
  run tracker, offline fitness app, private fitness app, no account*
- secondary: *gym log, strength training, bodyweight tracker, meal tracker,
  rest timer, workout programs*

Rationale: Play penalizes keyword stuffing and rewards a readable description
that repeats the core phrases a couple of times. The §4 long description already
carries these; keep it that way rather than appending a keyword dump.

---

## 6. Screenshot plan (5 screenshots)

Capture from a real build with **synthetic/demo data only** — no real GPS route
near a home location, no real email, no tokens or dev URLs
(`APP_STORE_METADATA.md` screenshot rules apply). First screenshot is the most
important; lead with the differentiator, not a feature dump.

| # | Screen to capture | Overlay caption / value line |
|---|-------------------|------------------------------|
| 1 | **Home dashboard** (`/`) — calories remaining, bodyweight trend, active program / start-workout card | **"Your whole day at a glance — no account, all on your phone."** |
| 2 | **Live workout** (`/workout`) — set rows with previous-performance, rest timer running | **"Log every set with a rest timer that survives a locked screen."** |
| 3 | **Nutrition day view** (`/nutrition`) — food log grouped by meal, calorie & macro progress | **"Track calories and macros your way — custom foods, saved meals, barcode."** |
| 4 | **AI meal-photo estimate** (nutrition camera → analysis draft) — editable ingredient rows with total calories | **"Snap a meal for an instant estimate — you review and edit before it logs."** |
| 5 | **Run tracking or run history** (`/run` or `/history`) — pace, splits, moving time (synthetic route) | **"Outdoor GPS and treadmill runs — your location never leaves your device."** |

Optional 6th (if the store slot allows and privacy is the hook to reinforce):

- **Settings → data controls / backup** (`/settings`) — export + optional cloud
  backup — **"Export a backup anytime. Cloud sync is optional and off by default."**

Design notes for overlays: dark theme (the app is dark-only); short caption, one
line; keep captions honest (say "estimate", say "optional"); do not overlay any
claim of medical benefit, diagnosis, or guaranteed results.

---

## 7. Store category & content-rating notes

**Primary category:** Health & Fitness (both Apple and Google Play). This is the
expected choice in `APP_STORE_METADATA.md` and matches every core feature.

**Secondary category (Apple, optional):** leave blank, or *Lifestyle* only if a
secondary is required. No defensible second category beyond Health & Fitness.

**Content rating:**

- Content itself is mild — a fitness/nutrition logger with no user-generated
  public content, no ads, no social feed. On Apple's questionnaire this maps to
  a low age rating on *content* grounds; on Google's IARC questionnaire it maps
  to *Everyone*.
- **Do NOT select "Made for Kids" / a child-directed rating.** Answer each
  questionnaire from actual app behavior (`APP_STORE_METADATA.md`).
- **18+ eligibility floor is a DEFERRED, store-publication decision, not part of
  this PWA soft-launch.** `docs/DECISIONS.md` (2026-08-19) sets an 18+ minimum
  for the *worldwide app-store* track (Step 8) to avoid the minor-compliance
  surface. That is a legal/eligibility floor set in the Terms and age docs at
  store-submission time — it is separate from the IARC/Apple *content* rating,
  and it does **not** apply to the free, US-only, no-login PWA soft-launch this
  copy is for. When this copy is reused for the App Store / Play, revisit the age
  gating and Terms with the then-current publication decision.

**This-launch config note:** the PWA soft-launch is free, US-only, no login, no
subscription (`docs/LAUNCH_PLAN.md`). No pricing, "Pro", or subscription language
belongs anywhere in this copy.

---

## 8. What the owner must supply (blockers before this copy ships)

1. **Final public name.** "Vigorune" is provisional pending naming + trademark
   review (`docs/DECISIONS.md`). Confirm the name — or confirm it's OK to
   soft-launch under a provisional name — before any of this copy is published or
   the name is used in ads. If it changes, find/replace throughout this doc and
   `APP_STORE_METADATA.md`.
2. **Trademark status.** Confirm whether "Vigorune" (or the final name) is clear
   to use publicly. Until then, treat the name as a placeholder.
3. **App icon / brand mark.** A purple fitness-log mark exists
   (`docs/DECISIONS.md`, 2026-06-27) but confirm the final icon + any wordmark
   used on screenshots and store tiles.
4. **Support contact.** A monitored support email + the public `/support`,
   `/privacy`, `/account-deletion` URLs on the production origin
   (`APP_STORE_METADATA.md`). Needed before the shareable link goes out.
5. **Screenshot data set.** Approve the synthetic demo data used for the 5
   screenshots (no real GPS, email, or tokens).
6. **Tagline pick.** Choose one of the three §2 taglines (or approve an
   alternate) so social posts and the storefront lead line match.
7. **Launch channels.** Step 5 of the launch plan (owner picks the one niche +
   3–4 channels) determines which §9 social drafts to use where.

---

## 9. Soft-launch social posts (drafts)

Honest, non-spammy, first-person solo-dev voice — this is a soft launch asking
for feedback, not a hard sell. Insert the final name + link before posting. Each
is a draft for the owner to post; **posting is an owner action.**

### A. Reddit (r/fitness-adjacent, r/selfhosted, r/privacy, r/webdev, etc.)

> I built a private, local-first fitness tracker — no account, works offline
>
> I got tired of fitness apps that make you sign in and upload everything just to
> log a workout, so I built my own. It tracks workouts (programs + live set
> logging with a rest timer), nutrition (calories/macros, custom foods, barcode,
> optional AI meal-photo estimates), bodyweight trends, and GPS/treadmill runs.
> Everything stays on your device — no account required and it works offline.
> Cloud backup is optional and off by default.
>
> It's free, still early, and I'm looking for honest feedback. It installs
> straight from the browser (PWA), no app store needed. Link in a comment. Happy
> to answer anything or hear what's missing.

*(Read each subreddit's self-promo rules first; some require the link in a
comment, not the post. Disclose that you're the developer.)*

### B. TikTok / Instagram Reels (spoken/caption over a screen recording)

> POV: a fitness tracker that doesn't ask you to make an account.
>
> No login, works offline, and your data actually stays on your phone. Log your
> lifts, your macros, your runs — snap a photo of your meal for a quick estimate
> — all private by default. It's free and installs right from your browser. I'm
> a solo dev, link's in my bio, tell me what to build next.

*(Show the real app: home → live workout set logging → meal photo estimate.
Keep on-screen text honest: "estimate", "optional".)*

### C. Short X / IG caption (text-first)

> I made a fitness tracker that keeps your data on your phone. 📵
>
> Workouts, nutrition, runs, bodyweight — no account, works offline, nothing
> sold. Free and installs from your browser. Solo dev looking for early feedback
> 👇

---

## 10. Copy consistency checklist (before publishing)

- [ ] Final name substituted everywhere (this doc + `APP_STORE_METADATA.md`).
- [ ] Trademark cleared, or provisional-name launch explicitly approved.
- [ ] Every "offline / no account / on your device" claim paired with the
      "optional" caveat wherever cloud backup, sign-in, barcode, or AI is mentioned.
- [ ] No subscription, price, "Pro", or worldwide-availability language.
- [ ] No medical / diagnosis / guaranteed-results claims; "estimate" used for
      calorie, macro, pace, and AI outputs.
- [ ] Support / privacy / account-deletion URLs live and monitored.
- [ ] Screenshots use synthetic data only (no real GPS/email/tokens).
- [ ] Category = Health & Fitness; no "Made for Kids"; 18+ store-track note left
      as deferred, not applied to the PWA soft-launch.
