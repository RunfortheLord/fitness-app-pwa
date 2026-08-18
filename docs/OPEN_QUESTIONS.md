# Open Questions (Historical)

There are no unresolved questions in this file that expand the frozen Version 1
scope. The historical questions below are retained with their documented
resolutions. Reopening one requires an explicit requirements or decisions
update and is otherwise post-Version 1 work.

## Backup Merge Semantics — Resolved

- Version 1 restore is replace-only. Merge remains unavailable until a complete
  conflict policy is approved.

## Active Cycle Replacement — Resolved

- Activating a template marks the previous active cycle inactive so exactly one
  cycle is current.

## Empty Workout — Resolved

- Empty ad hoc workouts are deferred beyond Version 1. Version 1 workouts start
  from a manually selected program day.

## CSV Export Shape — Resolved

- The readable fitness-data export is one local archive containing separate CSV
  files per table/domain. JSON remains the authoritative restore format.

## Units Beyond Pounds — Resolved

- Pounds remain the canonical stored unit and default display. The lb/kg
  preference changes display and interpretation of new entries without mutating
  history.

## Exercise Replacement Set Preservation — Resolved

- The replacement flow confirms whether compatible set data is retained when
  tracking methods differ. Historical records remain unchanged.
