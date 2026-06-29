# Progression Recommendations

## Scope

Progression recommendations are deterministic local rules. They do not call AI,
remote services, food databases, accounts, cloud sync, or wearable data.

Supported automatic progression methods:

- Weight and repetitions
- Assisted weight and repetitions
- Added weight and repetitions

Unsupported automatic progression methods return typed hold results:

- Repetitions only
- Duration
- Distance
- Bodyweight repetitions

## Target Terms

- Original target: immutable target snapshotted from the programmed workout.
- Suggested target: engine-generated target.
- User-edited target: manual target entered after a suggestion is shown.
- Effective target: user-edited target, then suggested target, then original
  target.
- Actual result: completed logged performance. Actuals are never overwritten by
  targets.

## Increments And Direction

The engine uses each exercise's stored `defaultWeightIncrement`. Missing, zero,
negative, or non-finite increments produce an `invalid_increment` hold result.
Arithmetic is normalized to avoid floating-point display artifacts.

Weight and repetitions: higher weight is harder. Added-weight exercises store
only external added load; body weight is not included. Assisted-weight exercises
are reversed: lower assistance is harder, so an increase in difficulty subtracts
the increment from assistance and clamps at zero.

## Current-Workout Rules

When a weighted-repetition exercise starts with prior completed history, every
programmed set is prefilled from the corresponding set in the most recent
session for the same stable exercise ID, regardless of program or day. Added
sets use the last usable prior set. The prior set's Epley estimate is translated
to the new prescription's minimum reps and rounded to the exercise's weight
increment. The target reps are also prefilled. If an estimate is unavailable,
the prior load is retained. These values are suggestions and remain editable;
focusing a populated numeric field selects its full value.

After a programmed set is completed, the next uncompleted programmed set for the
same exercise is recomputed from the original target and completed actual reps.
Re-rendering and reload do not compound suggestions.

Rules:

- Above the programmed max: suggest one increment harder and show the bottom of
  the existing rep range.
- Exactly at max: hold.
- Within range, including exactly at min: hold.
- Below min: suggest one increment easier and show the bottom of the existing
  rep range. The Failed toggle remains independent and is preserved for review,
  but it is not required for this current-workout reduction.
- Skipped set or exercise: hold.
- Missing rep range, target, reps, increment, or unsupported method: typed hold.

Users may edit the target before completing the set. The edit remains separate
from the engine suggestion and can be cleared back to the original target. The
effective target is not copied into actual performance fields.

## Next-Workout Rules

Only programmed sets qualify. Added live sets remain in history but do not
determine progression and do not become the final programmed RIR set.

The engine compares the current completed exercise against the most recent
comparable previous completed performance with the same stable exercise ID and
tracking method, preferring the same template/day/source context when available.

Rules:

- Increase by one increment only when current and previous comparable workouts
  both completed every programmed set, had no skipped or failed programmed sets,
  reached at least the programmed maximum on every programmed set, and the final
  programmed set has RIR 2 or greater.
- Hold for one qualifying workout, normal in-range performance, missing prior
  comparable performance, missing or insufficient final-set RIR, skipped sets
  without independent repeated failure evidence, unsupported methods, or no
  material target change.
- Reduce by one increment only when current and previous comparable workouts
  each have at least half of programmed sets below the minimum or at least one
  failed set below the minimum.

Only the final programmed set's RIR is used. RIR 0 or 1 blocks the top-range
increase; missing final-set RIR produces a conservative hold for increases.

## Reason Codes

Current-workout reason codes:

- `above_range_increase_difficulty`
- `exactly_at_maximum_hold`
- `within_range_hold`
- `below_minimum_without_failure_hold`
- `below_minimum_failed_reduce_difficulty`
- `skipped_no_progression`
- `missing_rep_range`
- `missing_target`
- `invalid_increment`
- `unsupported_tracking_method`
- `manual_target_retained`

Next-workout reason codes:

- `repeated_top_range_increase`
- `top_range_insufficient_history_hold`
- `insufficient_final_rir_hold`
- `missing_final_rir_hold`
- `normal_in_range_hold`
- `repeated_missed_minimums_reduce`
- `repeated_failed_performance_reduce`
- `skipped_programmed_set_hold`
- `no_comparable_previous_performance_hold`
- `unsupported_tracking_method`
- `no_material_prescription_change`

## Persistence And Review

New live sets may include optional `targetSnapshot` and
`targetRecommendation` metadata. Older active workouts and completed workouts
without those fields remain valid.

Material next-workout recommendations are stored as pending detected changes
with type `progression_recommendation`. They are unchecked by default and use
the existing destinations: Active Cycle Only, Template Only, or Both. Unchecked
recommendations are saved as not applied. Applying Both updates the active
cycle and reusable template target consistently in one transaction.

## Known Limitations

- Repetitions-only, duration, distance, and bodyweight-only progression rules are
  intentionally hold-only in this version.
- Current-workout suggestions apply to remaining existing programmed sets; no
  extra set is fabricated.
- Manual iPhone QA should cover compact row readability, target editing,
  restore-original behavior, reload/resume, horizontal swipe navigation, rest
  timer behavior, and finish-workout review selection.
