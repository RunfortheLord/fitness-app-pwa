# User Flows

## First Launch

1. User opens the installed PWA or visits the app in Safari.
2. App loads the application shell.
3. App initializes IndexedDB if no local database exists.
4. App shows Home with empty dashboard cards and no account prompt.
5. User can open Settings to set calorie and macro targets.
6. User can use Add, Nutrition, Training, and History without signing in.
7. If offline after installation, app still opens and shows local data.

## Creating a Food

1. User opens Nutrition or taps Add.
2. User chooses Create Food.
3. App opens a bottom sheet or full form.
4. User enters name, optional brand, serving quantity, serving unit or
   description, calories, protein, total carbohydrates, fat, and optional notes.
5. App validates required fields and nonnegative nutrition values.
6. User saves.
7. App stores the reusable food with created and updated timestamps.
8. Food appears in search and recent foods after use.

## Logging Food

1. User opens Nutrition for the selected local date.
2. User searches recent foods, custom foods, previously used foods, or remote
   providers.
3. App searches remote providers only after at least two normalized characters
   and debounces requests.
4. User selects a food.
5. App opens a detail sheet with calories, protein, total carbohydrates, fat,
   serving amount, and available serving units.
6. User edits serving amount or chooses grams/mass ounces when reliable
   conversion is available.
7. App previews calories and macros for that amount.
8. User logs the food.
9. App creates a date-based log entry that snapshots the food values and
   provider metadata when known.
10. Daily totals update immediately.
11. If a reusable or provider-retained food changes later, this logged entry
    keeps its original snapshot values.

## Correcting an Imported Food

1. User selects an imported provider food or a provider search result.
2. User chooses Custom copy.
3. App opens the custom food form prefilled from the provider record.
4. User edits values locally and saves a private custom food.
5. App does not submit the custom copy to USDA, Open Food Facts, or another
   shared database.

## Entering Bodyweight

1. User opens Home for a selected local date or taps Add.
2. User chooses Log Bodyweight.
3. App opens a fast bodyweight entry sheet for the selected local date.
4. User enters bodyweight in pounds by default.
5. App validates a positive realistic numeric value.
6. User saves.
7. App creates a new timestamped bodyweight entry for that local date.
8. Home immediately refreshes current bodyweight, selected-date status, recent
   activity, and the compact trend summary.
9. If the user needs to correct the selected date's latest entry, the user
   chooses Edit Latest, changes the value, and saves. The app updates that
   selected record instead of rewriting other same-day records.

## Viewing Bodyweight Progress

1. User opens Home.
2. User chooses View Graph from the Bodyweight card.
3. App opens History in the Bodyweight Progress view.
4. User chooses 1M, 3M, 6M, or All range.
5. App plots each retained bodyweight entry by timestamp. Multiple same-day
   entries remain separate points.
6. User taps or focuses a point.
7. App shows the selected entry's bodyweight, local date, and timestamp.
8. Empty and one-point states avoid showing a misleading trend.

## Creating an Exercise

1. User opens Training or taps Add.
2. User chooses Create Exercise.
3. User enters a required exercise name.
4. User optionally enters notes and default rest time in seconds.
5. User selects one tracking preset: Weight + reps, Bodyweight + reps, Assisted weight + reps, Reps only, Duration, or Distance + duration.
6. App validates the name and tracking preset.
7. User saves.
8. App stores an active exercise with created and updated timestamps.

## Creating a Program

1. User opens Training.
2. User chooses Create Program.
3. User enters program name and optional notes.
4. User adds ordered workout days.
5. User gives each day a name and optional notes.
6. User adds prescribed exercises to each day.
7. For each prescribed exercise, user may set target sets, target reps or range, target RIR, rest override, and notes.
8. User saves the program template.
9. The template appears in the program library.

## Activating a Program

1. User opens Training and selects a program template.
2. User chooses Activate Program.
3. App explains that activation creates an independent active-cycle copy.
4. User confirms.
5. App copies the template structure into a new active cycle.
6. Existing completed workouts and in-progress workouts are not rewritten.
7. Home and Training show the active program.

## Manually Selecting a Workout Day

1. User opens Home or Training.
2. User views the active program and its workout days.
3. User selects a workout day manually.
4. App opens the workout-day detail.
5. App shows prescribed exercises, target set information, and previous performance where available.
6. User chooses Start Workout.

## Starting a Workout

1. User starts from a manually selected workout day.
2. App checks whether another active workout exists.
3. If one exists, app offers Resume or Cancel Existing Workout with confirmation.
4. If no active workout exists, app creates an active workout session.
5. App snapshots the source active-cycle day structure into the active workout.
6. App records local date and start timestamp.
7. App opens the live workout screen.

## Completing Sets

1. User opens an exercise card in the live workout.
2. App shows set rows with fields appropriate to the exercise tracking method.
3. For weighted exercises, user enters weight, reps, optional RIR, and completion status.
4. App persists changes immediately or near-immediately.
5. When a set is marked complete, app starts or offers the rest timer using the configured rest duration.
6. User may pause, skip, extend, or dismiss the rest timer.
7. User may edit completed sets.
8. User may add or delete sets.

## Replacing an Exercise

1. User opens exercise options during an active workout.
2. User chooses Replace Exercise.
3. App opens exercise search.
4. User selects a replacement exercise.
5. App confirms whether to keep compatible set data or start fresh when tracking methods differ.
6. App updates the active workout only.
7. App records a structural change candidate for completion review.

## Finishing a Workout

1. User taps Finish Workout.
2. App validates that at least one set or explicit skipped exercise exists.
3. App allows workout-level notes.
4. User confirms completion.
5. App saves a historical workout with start time, completion time, duration, exercises, sets, notes, skipped exercises, and source references.
6. App compares the performed workout to the source active-cycle day.
7. If no structural changes are detected, app closes the active workout and shows workout history detail.
8. If changes are detected, app opens detected-change review.

## Reviewing Detected Changes

1. App shows a checklist titled Changes Detected.
2. Each structural change appears as an individual item.
3. User reviews set added, set removed, exercise added, exercise skipped or removed, exercise replaced, or exercise order changed items.
4. Performed weight, reps, RIR, completion status, and duration are not listed as structural changes.
5. User may leave every item unselected.
6. User proceeds to destination selection or finishes without applying changes.

## Applying a Change to Cycle, Template, Both, or Neither

1. User selects one detected structural change.
2. User chooses one destination: current active cycle only, reusable program template only, both active cycle and template, or neither.
3. User repeats this for each change they want to apply.
4. User confirms.
5. App applies selected changes in a transaction.
6. If any update fails, app rolls back all related cycle/template updates and keeps the saved workout intact.
7. App records which changes were applied or rejected in workout history.

## Viewing Workout History

1. User opens History.
2. App lists completed workouts and completed runs by local date.
3. User opens a workout.
4. App shows source program/day when applicable, start time, completion time, duration, exercise details, performed sets, skipped exercises, notes, and change review outcomes.
5. User may edit notes and recorded performance values.
6. Edits do not change the source program template.
7. User may delete the historical workout only after confirmation.

## Tracking a Run

1. User opens Run.
2. App shows Start Run without requesting location permission yet.
3. User taps Start Run.
4. App checks that no active run or active lifting workout exists, then starts
   foreground geolocation.
5. App stores every received sample with accuracy, timestamp, decision, and
   rejection reason when applicable.
6. App updates elapsed time, moving time, distance, current pace, average
   moving pace, and mile splits from accepted samples only.
7. User may Pause and Resume.
8. If recent speed stays low past the configured threshold and cooldown, app
   asks whether the user is walking, resting, or continuing.
9. User taps Finish and confirms.
10. App saves the completed run and keeps samples, pauses, splits,
    classifications, and GPS-gap markers for History and backup.

## Viewing Run History

1. User opens History.
2. User opens a completed run.
3. App shows date, distance, elapsed time, moving time, average pace, started
   and completed timestamps, mile splits, walking/rest classifications, and GPS
   gap status.
4. App does not show run samples as lifting set rows.

## Exporting Backup

1. User opens Settings.
2. User chooses Export Backup.
3. App creates a full-fidelity JSON backup with backup schema version and database schema version.
4. App offers the JSON file for local download/share.
5. User may also choose CSV export for readable spreadsheet files.
6. JSON and CSV exports use historical food-log snapshots, including food name,
   optional brand or restaurant, provider identity when known, serving amount,
   consumed multiplier, calories, protein, total carbohydrates, fat, and
   conversion metadata.
7. CSV export includes readable records but is not treated as full-fidelity
   backup.

## Restoring Backup

1. User opens Settings.
2. User chooses Restore Backup.
3. User selects a JSON backup file.
4. App validates JSON shape, backup schema version, database schema compatibility, IDs, references, and required fields.
5. App shows an import preview and explains replace versus merge behavior.
6. If replacing data, app requires destructive confirmation.
7. App imports in a transaction.
8. If import fails, existing data remains unchanged.
9. App reloads local data after successful restore.

## Using the App Offline

1. User installs the PWA while online.
2. Service worker caches the application shell.
3. User later opens the installed app without internet.
4. App loads from the cache and reads records from IndexedDB.
5. User logs recent foods, private custom foods, and previously used provider
   foods offline from IndexedDB.
6. Remote-only provider search clearly indicates that connectivity is required.
7. User logs bodyweight, workouts, and foreground runs offline when browser
   location permission and platform behavior allow it.
8. App persists all changes locally.
9. When online again, no cloud sync is attempted.
10. If a newer application version is available later, app notifies the user
    deliberately.
