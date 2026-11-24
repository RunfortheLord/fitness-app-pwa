# Periodized programs

Training → Program library contains **February 2027 Powerlifting Peak + Upper Body Hypertrophy**. Activate it to create an independent active cycle. Periodization starts off. To use its schedule, open the program editor, then Settings, and turn on **Enable periodization**. It runs November 23, 2026 through February 28, 2027. Week 14 replaces the normal split with bench on February 22, squat on February 24, and sumo deadlift on February 27. There is no December max test.

The calendar determines the current week, while the user always chooses and starts the workout. Use the week selector in **Weekly plan** to inspect the schedule. Starting a completed day/week twice is prevented; open History to resume the original workout. There are no catch-up sessions or automatic extra sets for missed days or illness.

## Editing and creating programs

In the program editor, open **Weekly plan**, choose a week and tap a day, exercise, and set group. **Apply changes to** selects that week, its phase, or program defaults. Precedence is defaults → phase override → week override → live session target. Reset an override to return to inherited values. Changes persist only when **Save changes** succeeds. Completed workouts keep their original dates, set prescriptions, and actual results.

Create an ordinary program with the existing editor, add days and exercises, set the program length, then enable periodization in Settings. Choose **Schedule** to set its start date and assign phases. Open an exercise in the weekly plan to edit its set groups. Phase names alone do not generate training prescriptions: configure the sets, reps, RIR, percentages, and progression rules explicitly. You can also clone the February program as a starting point; cloning remaps all prescription and day identifiers.

Duplicate a week to extend the schedule, or duplicate an entire phase. Change the program start date to reschedule it, or edit a day's assigned date within its training week. Pause blocks new sessions; resuming shifts the start date by the elapsed pause days. Completed history is never shifted. Editing a saved template affects future activations; edit the active cycle to change the current run. Activate a conventional repeating program to return to the existing behavior.

## Recommendations and logging

The supplied strength values are prescription references, not historical workout records. Accessory loads use real exercise history. No performances or bodyweight logs are seeded. New exercise definitions are created through the existing exercise repository only after checking exact names and synonyms.

Main-lift load estimates translate recent completed, nonfailed sets of up to ten reps into the new rep/RIR or percentage prescription. RIR estimates are capped at three reps of reserve to reduce overconfidence. Comparable prescriptions permit at most one 2.5–5 lb equipment increment, with an increase only after reaching the upper rep target at the intended reserve. Phase transitions recalculate capacity for the new stimulus. Top and back-off groups remain independent. Accessories reuse the existing smart-prefill calculation when smart progression is enabled. Unsupported or missing performance data produces a conservative hold or an empty load.

Planned values are snapshotted separately from actual load, reps, and RIR, which begin blank. In a live workout, use the exercise’s **More exercise actions** menu and choose **Set targets** for a session-only load adjustment or max-attempt bar speed. Log actual results in the usual fields. Substitutions must have compatible tracking methods. Deload and taper sessions remain in History but do not lower capacity or progression comparisons. Program completion does not rewrite future prescriptions.

Max testing starts with warm-ups and three capacity-based attempts, rather than prescribing stretch goals. Later recommendations incorporate successful reps, recorded RIR, and user-reported bar speed. A miss, grind, or zero-RIR result stops further recommended increases. The existing Add Set action permits an optional fourth only after three successful singles and a fast third with at least one RIR. Spotters, safeties, and stopping after pain or failure remain the lifter's responsibility.

## Persistence and implementation

Optional validated `periodization` fields on existing templates and cycles store defaults and sparse overrides. No stores, persisted IDs, or existing records are renamed, and no destructive migration is necessary. Existing JSON/cloud backup validators include the plan, session schedule snapshot, planned set groups, and bar speed. Active sessions and history use the existing Dexie stores and lifecycle.

The panel reports completed sessions and actual exercise strength trends using the established strength calculations, with links through the existing History workflow. It does not manufacture fatigue scores or treat uncertain estimates as guaranteed maximums. Baseline goals remain visible in test-week notes.

Main components: `src/domain/periodization.ts`, `src/domain/februaryPeak.ts`, `src/repositories/periodizationRepository.ts`, and `src/features/training/PeriodizedProgramPanel.tsx`. Integrations extend program activation/cloning, workout startup/logging, Training, Home dashboard loading, and backup validation.
