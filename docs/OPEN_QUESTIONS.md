# Open Questions

These are the remaining issues that cannot be fully resolved from the current requirements. They must not block specified MVP behavior.

## Backup Merge Semantics

- Should JSON restore support merge in the first release, or should the MVP provide replace-only restore with the UI explaining that merge is unavailable?
- If merge is supported, what is the conflict policy when imported IDs already exist locally?

## Active Cycle Replacement

- When a user activates a new program while another active cycle exists, should the prior active cycle become inactive, archived, or remain selectable?

## Empty Workout

- The fallback UI mentions a start-or-resume workout card and the video analysis references empty workout access, but the binding requirements emphasize starting from a manually selected workout day. Should first release include an empty ad hoc workout, or defer it until after program-based workouts are complete?

## CSV Export Shape

- Should CSV export produce one combined archive with multiple files, or separate CSV files per domain such as foods, food logs, bodyweight, exercises, programs, and workouts?

## Units Beyond Pounds

- Pounds are the default bodyweight unit. Should kilograms be available in the first release as a setting, or deferred?

## Exercise Replacement Set Preservation

- When replacing an exercise during an active workout, should compatible existing set values be preserved by default, discarded by default, or prompt every time?
