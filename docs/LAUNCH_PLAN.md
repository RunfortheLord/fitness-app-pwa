# Vigorune — Launch Plan (owner's basis plan)

> **This is the owner's authoritative launch plan. Follow these 8 steps in order.**
> Owner: Adam Shugart (individual, no LLC, Texas). Strategy: validate cheaply
> BEFORE spending on stores/legal/worldwide compliance. Related:
> `docs/DECISIONS.md`, `docs/PUBLICATION_READINESS_MASTER_AUDIT.md`.

## Guiding principle
Prove people keep using it (retention) before charging; prove they'll pay before
going worldwide. Launch first in the cheapest, lowest-legal-cost configuration.

## Launch configuration for Steps 0–7
**Free · US-only · no mandatory login · subscription code OFF · PWA first**
(no App Store review, no $99 Apple fee, no EU representatives, minimal privacy-law
cost). The built subscription/entitlement/locked-mode code stays behind its
default-OFF flag until Step 8.

## The 8 steps

| # | Step | Owner | Status |
|---|------|-------|--------|
| 1 | **Lock launch settings** — free, US-only, no login, subs OFF, PWA first | decided | ✅ done |
| 2 | **Add basic privacy-friendly metrics** — track app-open, workout logged, meal logged, run tracked, next-day return; anonymous, no PII, disclosed. *Blocker for measuring anything.* | Claude | ▶ in progress |
| 3 | **Deploy the PWA to a public URL** (Vercel) + verify install-to-homescreen. Produces the shareable link = the launch. *Gated: after Step 2 + owner OK (public launch action).* | Claude + owner OK | ⏳ queued |
| 4 | **Storefront basics** — name, one-line pitch, short description, 3–5 screenshots. Lead with "private, local-first, no account, works offline." Reused later for app stores. | Claude drafts / owner supplies | ▶ in progress |
| 5 | **Pick niche + channels** — ONE audience; 3–4 places they gather (subreddits/Discord/TikTok/IG). | owner | ☐ todo |
| 6 | **Soft launch** — share the link in those channels over a week; ask for feedback. | owner | ☐ todo |
| 7 | **Watch metrics 30 days** — installs, activation, D7 & D30 retention. Target: **~20%+ still using at day 30.** | owner (Claude sets up view) | ☐ todo |
| 8 | **Decide from data (~day 30)** — good retention → turn ON subscription code + package for App Store/Play + start worldwide/legal work. Weak → fix product/audience first. | owner + Claude | ☐ todo |

## Cost through Step 7
~$0 — no Apple/Google fees, no lawyer, no EU reps. All deferred to Step 8, after
demand is proven.

## Metrics definitions (Step 7)
- **Activation:** new user logged at least one workout/meal/run.
- **D7 retention:** used the app again ~7 days after first use.
- **D30 retention:** used it again ~30 days after first use. ← the number that matters.
- All measured anonymously (no accounts in this phase). Disclose analytics in the
  in-app privacy copy and the privacy drafts.

## Deferred until Step 8 (do NOT do now)
Subscription/billing turn-on, App Store/Play accounts + review, worldwide
distribution, EU/UK representatives, lawyer review, LLC/insurance, published
business address. These are real costs justified only once retention is proven.
