# Fitness App 3 — Rollback Manifest

This manifest lets a future session reverse the **Fitness App 3 update (Batch 1)**
safely and deterministically. Batch 1 is the set of nutrition-focused changes
deployed to the stable production URL on 2026-06-23. Batch 2 (Set Goal UI,
program library, next-up/darkening) is **not yet implemented** — only the pure
Set Goal math core (`src/domain/goalMacros.ts`, unused by the UI) shipped.

## Key references

| Item                                           | Value                                                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production branch                              | `main`                                                                                                                                                                       |
| Stable production URL                          | https://fitness-app-pwa-eight.vercel.app                                                                                                                                     |
| Pre-change Git SHA                             | `219a2280e86c6c041106b04f74e07d85f822901f` (`219a228`)                                                                                                                       |
| Pre-change recovery tag                        | `pre-fitness-app-3-update-20260623-1326` (annotated, → `219a228`)                                                                                                            |
| Pre-change Vercel deployment (ROLLBACK TARGET) | id `dpl_zBnoxXA6WaJAJZdCQpFyj6pk5z32` — `https://fitness-app-n80n9nsv1-adamshugart27-4515s-projects.vercel.app`                                                              |
| New Vercel deployment (current production)     | id `dpl_GGxpisRytWDyro3ZWc8ssHtJQmoR` — `https://fitness-app-14f7amatp-adamshugart27-4515s-projects.vercel.app`                                                              |
| Superseded interim deployment                  | id `dpl_GZMfPsFnAUzSeu5uP7RDYX6NVUqa` — `https://fitness-app-ocm1r68u7-adamshugart27-4515s-projects.vercel.app` (first Batch-1 deploy; replaced by the clean-build redeploy) |
| Deployed commit                                | `0ab19b3` (verified via `/build-info.json`)                                                                                                                                  |
| Vercel project                                 | `fitness-app-pwa` (org `team_SMU4EzReKZGL5BPjbbwcG3aN`, scope `adamshugart27-4515s-projects`)                                                                                |

## New commits created by this task (oldest → newest)

1. `5cb9da1` — Use server-configured USDA key when no user key is set
2. `351d08c` — Fix confusing serving labels like "1 36 g"
3. `6413048` — Strip redundant leading brand from food names
4. `a85e25d` — Show calorie equation and move Save food to top of custom food form
5. `a04aa71` — Cap over-long generic food search section
6. `f3b0736` — Show food category icons on the left of food results
7. `de1e10f` — Add Set Goal macro/calorie math core (unused by UI yet)
8. `d0eb632` — Retry transient e2e failures in Playwright config
9. `0ab19b3` — Reference Node types in food API functions (**deployed HEAD**)

(The commit that adds this manifest is documentation only and is not deployed.)

## Files added

- `src/domain/foodSearchSections.ts`
- `src/domain/foodIcons.ts`
- `src/domain/foodIcons.test.ts`
- `src/components/FoodIcon.tsx`
- `src/domain/goalMacros.ts`
- `src/domain/goalMacros.test.ts`
- `docs/FITNESS_APP_3_ROLLBACK.md` (this file)

## Files modified

- `api/foods/search.ts`, `api/foods/details.ts`, `api/foods/barcode.ts`,
  `api/foods/test-key.ts` (server env-var key fallback + node type reference)
- `src/pages/NutritionPage.tsx` (search gating, brand display, custom-food form,
  section cap extraction, food icons)
- `src/pages/NutritionPage.test.tsx`
- `src/domain/foodServings.ts`, `src/domain/foodServings.test.ts`
- `src/domain/foodProviderModels.ts`, `src/domain/foodProviderModels.test.ts`
- `playwright.config.ts` (e2e retries)
- `docs/DECISIONS.md` (food category icon decision)

## Files removed

- None.

## Environment / deployment configuration changes

- Added Vercel **project** environment variable `USDA_FDC_API_KEY` (Production,
  encrypted) so the food API works without a user-entered key.
- No Vercel project, domain, or other configuration was changed.
- A local, git-ignored `.env.local` (and the `.env.deploy/` folder) hold the
  deploy token locally; they are NOT committed and may be deleted at any time.

## Persistent-data migrations

- **None.** Batch 1 introduced no IndexedDB schema changes; the database schema
  remains version **9**. All changes are display/logic/server-side only.
- Fully backward compatible: the previous production build reads and writes the
  same data. No data was transformed.

## Tested rollback procedure (preserves Git history)

1. **Restore the stable alias first** (minimize downtime), pointing it back to
   the recorded pre-change deployment:
   ```sh
   npx vercel whoami                 # use the CLI credential store
   npx vercel alias set \
     fitness-app-n80n9nsv1-adamshugart27-4515s-projects.vercel.app \
     fitness-app-pwa-eight.vercel.app
   ```
   (Equivalently, `vercel rollback dpl_zBnoxXA6WaJAJZdCQpFyj6pk5z32`.)
2. **Revert the feature commits** with new revert commits, newest → oldest, so
   history is preserved (do NOT reset/force-push):
   ```sh
   git revert --no-edit 0ab19b3 d0eb632 de1e10f f3b0736 a04aa71 a85e25d 6413048 351d08c 5cb9da1
   ```
   (Skip `d0eb632`/`de1e10f` if you wish to keep the e2e retry config and the
   inert goal-math module — both are harmless.)
3. Push the revert commits to `main`.
4. Validate the reverted source: `npm run check`.
5. Re-deploy the reverted source as a new production deployment:
   `set -a; . ./.env.local; set +a; npx vercel deploy --prod --yes`.
6. Confirm the stable URL serves the reverted build and matches pre-change
   behavior (`/build-info.json` gitHash = the revert HEAD).
7. Optionally remove the Vercel env var: `npx vercel env rm USDA_FDC_API_KEY production`.

Do not delete the recovery tag, the feature commits, or the revert commits.
Use the recovery tag/branch only as an emergency comparison reference, not by
rewriting shared history.

## Rollback verification checklist

- [ ] `https://fitness-app-pwa-eight.vercel.app` returns 200 and loads the shell.
- [ ] Nested routes (`/nutrition`, `/training`, `/history`, `/settings`) load on refresh.
- [ ] Food search behaves as the pre-change build did (user-entered key required
      again if the Vercel env var was removed).
- [ ] No new console runtime errors.
- [ ] `/build-info.json` `gitHash` matches the intended reverted/restored commit.
- [ ] Existing IndexedDB data (workouts, nutrition logs, programs, custom foods,
      bodyweight, settings, history) is intact and unchanged.

## Scope note for "undo all the changes from the Fitness App 3 update"

Reverting only the commits listed above (and restoring the recorded alias)
reverses this task and nothing else. It must not touch later unrelated commits,
stored user data, other env vars, the Vercel project, or deployment history.
