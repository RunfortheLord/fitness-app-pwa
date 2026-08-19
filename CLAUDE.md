# CLAUDE.md — Orientation Map

> Purpose: let a fresh session start work without re-exploring. Read this first.
> Binding product rules live in `AGENTS.md` and `docs/` — this file is a navigation map, not a substitute. Keep it updated when structure changes.

## What this is

Single-user, **local-first fitness tracking PWA**. No backend for user data, no
accounts/login, no cloud sync. All user data lives in **IndexedDB via Dexie**.
The only server code is a thin food-database proxy (`api/`, `src/server/`).

## Tech stack

React 19 + TypeScript (strict) + Vite 8, `vite-plugin-pwa`, Dexie/IndexedDB,
React Router 7, Vitest + React Testing Library, Playwright (e2e), Zod, lucide-react
icons, `date-fns`. npm. Mobile-first CSS. Deploy target: Vercel.

## Commands

- `npm run dev` — dev server
- `npm run typecheck` / `lint` / `format:check` / `test` / `test:e2e` / `build`
- `npm run check` — runs all of the above (the full gate)
- `npm run deploy:stable` — deploy passing build to Vercel prod (see AGENTS.md rule on when to deploy)

## Path aliases (vite.config.ts + tsconfig)

`@app @components @db @domain @features @hooks @pages @repositories @services @styles @test @shared-types`
(`@shared-types` → `src/types`).

## Layered architecture (strict separation)

```
pages/ (React screens)  ── UI only, compose components + call repositories/services
features/               ── feature-scoped components + helpers (nutrition/, training/) used by their page
components/              ── reusable presentational + UI primitives (ui.tsx)
hooks/                  ── React hooks
services/               ── app-level orchestration (init, dashboard, backup, nutrition summary, food provider client)
repositories/           ── ALL IndexedDB access goes through here (Dexie). Pages never touch db directly.
domain/                 ── pure TypeScript: calculations, types-of-logic, no React, no Dexie
db/database.ts          ── Dexie schema + versioned migrations
server/ + api/          ── food-provider proxy ONLY (USDA / Open Food Facts)
types/app.ts            ── all shared domain types
styles/global.css       ── single global stylesheet (2700+ lines), CSS variables, className-based. No CSS-in-JS, minimal inline styles.
```

Rules that matter (from AGENTS.md): keep domain logic out of components; all DB
access behind repositories; pure functions in `domain/`; **never mutate completed
workout history** (templates snapshot into workouts); schema changes require a new
Dexie migration version (never rename/drop persisted fields without one); dates are
`YYYY-MM-DD` strings, timestamps ISO strings; IDs via `crypto.randomUUID()`.

## Pages → routes (src/app/router.tsx)

| Route                  | Page file           | Notes                                                                                     |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `/`                    | HomePage.tsx        | dashboard                                                                                 |
| `/nutrition`           | NutritionPage.tsx   | food log, recipes, saved meals, goals, macros — components in `features/nutrition/`       |
| `/run`                 | RunPage.tsx         | GPS run tracking                                                                          |
| `/training`            | TrainingPage.tsx    | programs, program library, templates, days/exercises — components in `features/training/` |
| `/workout`             | LiveWorkoutPage.tsx | active live workout, rest timer, sets                                                     |
| `/graphs` + `/history` | HistoryPage.tsx     | strength/bodyweight graphs + workout history                                              |
| `/settings`            | SettingsPage.tsx    | units, timer sound, goals, backup, integrations                                           |

Bottom nav: `components/BottomNavigation.tsx`; shell: `components/AppShell.tsx`.

## UI primitives (src/components/ui.tsx)

`AppHeader, PageContainer, Card, MetricCard, SectionHeader, BottomSheet,
ModalConfirmationDialog, SegmentedControl, DateSelector, PrimaryButton,
SecondaryButton, IconButton, FormField, NumericInput, EmptyState,
ValidationMessage, OfflineIndicator, LoadingState, StatusMessage, Toast`.
Touch drag-reorder lists: `SortableList/SortableListItem/SortableDragHandle`,
plus `SortableArea/SortableZone` for multi-list drag (e.g. cross-day drops)
(`components/SortableList.tsx`, dnd-kit; helpers in `components/sortableDrag.ts`).
Reuse these before hand-rolling. Theming via CSS vars in `global.css` (`--color-*`,
`--space-*`, `--radius-*`, `--bottom-nav-height`).

## Data model (types/app.ts) — entity groups

- **Nutrition**: `Food`, `FoodLogEntry` (carries immutable `FoodSnapshot`), `SavedMeal`
  (+`SavedMealComponent`), `FoodUnitPreference`, `BarcodeProductCache`,
  `NutritionTarget`, `NutritionGoal` (on `UserSettings`).
- **Bodyweight**: `BodyweightEntry`; trend logic in `domain/bodyweightTrend.ts`.
- **Exercises**: `Exercise` (origin `built_in`|`custom`), `TrackingMethod`/`TrackingMetric`,
  library seed in `domain/exerciseLibrary.ts`.
- **Programs (templates)**: `ProgramTemplate` → `ProgramTemplateDay` → `TemplateWorkoutExercise`.
  Built-in library: `domain/programLibrarySeed.ts` (6200 lines), `isBuiltIn` flag.
- **Active cycle** (a started program): `ActiveProgramCycle` → `ActiveCycleWorkoutDay` → `ActiveCycleWorkoutExercise`.
- **Workout (live + history)**: `Workout`→`WorkoutExercise`→`WorkoutSet`; history is a
  frozen copy in `workoutHistory*` tables. `Workout.activeRestTimer: RestTimerState`.
- **Runs**: `Run`,`RunSample`,`RunPause`,`RunSplit`,`RunClassification`.
- **Workout changes**: `DetectedWorkoutChange`/`AppliedWorkoutChange` (template diff review).

Snapshots (`FoodSnapshot`, `ExerciseSnapshot`, `WorkoutSourceSnapshot`) preserve
history when source records change — do not bypass them.

## DB schema & migrations (db/database.ts)

`DATABASE_SCHEMA_VERSION = 12`, `DATABASE_NAME = 'training-log'`. Each `this.version(n)`
block lists stores + an `.upgrade()`. To change schema: add a new `version(N+1)` block,
bump `DATABASE_SCHEMA_VERSION`, write the upgrade. Tests: `db/database.test.ts`,
repo `*.test.ts`, use `fake-indexeddb`.

## Key domain modules (pure, well-tested)

`restTimer`, `timerSounds`, `strengthProgress`, `bodyweightTrend`/`bodyweightProgress`,
`progressionRecommendations`, `setPropagation`, `effectiveLoad`, `workoutChanges`,
`meals`, `goalMacros`, `foodServings`, `foodSearchRanking/Sections`, `exerciseSearch`,
`changelog`, `dates`.

## Conventions / gotchas

- Every behavior change needs unit/component/integration/e2e coverage (see TEST_STRATEGY.md).
- Vitest files run with at most four workers. Keep each test file isolated from
  shared browser globals and use its own fake IndexedDB lifecycle.
- E2E in `e2e/app.spec.ts`, config `playwright.config.ts`.
- Don't broaden scope / add undocumented features (AGENTS.md). Record assumptions in `docs/DECISIONS.md`.
- 44×44px min touch targets; avoid horizontal scroll; safe-area insets; dark theme only.
- Changelog of shipped features: `domain/changelog.ts` (the in-app "What's new").

## docs/ index (read before non-trivial work)

`PRODUCT_REQUIREMENTS, DATA_MODEL_SPECIFICATION, UX_SPECIFICATION, USER_FLOWS,
PROGRESSION_RECOMMENDATIONS, TEST_STRATEGY, DEFINITION_OF_DONE, DECISIONS,
ROADMAP, BACKUP_FORMAT, FOOD_PROVIDERS, IPHONE_QA_CHECKLIST, UI_ACCESSIBILITY_AUDIT`.
