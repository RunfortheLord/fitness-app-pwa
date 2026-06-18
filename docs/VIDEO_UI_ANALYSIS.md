# Reference Fitness App UI Analysis

This document analyzes `reference/ui_reference.MP4` as an interaction and layout reference for a future local-first fitness PWA. The recording should inform information architecture, density, and control behavior, not pixel-perfect visual copying. Do not copy logos, brand names, proprietary illustrations, copyrighted artwork, or exact branded icon assets.

## 1. Video Metadata

- Source file: `reference/ui_reference.MP4`
- Container: QuickTime / MOV-compatible MP4 (`mov,mp4,m4a,3gp,3g2,mj2`)
- Duration: `284.293333` seconds, about 4 minutes 44 seconds
- File size: `145443605` bytes, about 138.7 MiB
- Overall bitrate: about `4092775` bps
- Created: `2026-06-18T15:47:02.000000Z`
- Video codec: HEVC / H.265 Main profile (`hvc1`)
- Resolution: `884x1920`, portrait
- Pixel format: `yuvj420p`
- Color: full range, BT.709 primaries/space, sRGB transfer
- Nominal frame rate: `120/1`
- Average frame rate: `682875/21322`, about 32.03 fps
- Video duration: `284.293333` seconds
- Video bitrate: about `4025230` bps
- Video frames: `9105`
- Audio codec: AAC LC
- Audio: mono, 44100 Hz
- Audio duration: `279.860317` seconds
- Audio bitrate: about `65164` bps

## 2. Screen-by-Screen Inventory

### iPhone Home and App Launch

- The capture begins and ends on the iPhone home screen.
- The fitness apps are grouped in an iOS folder, then one app opens into a dark workout interface.
- The recording includes iPhone status elements, Dynamic Island, and screen broadcast indicators, so the app layout must respect top safe areas.

### Active Program Workout Detail

- A workout-day screen shows a centered title, back affordance, utility icons, target muscle cards, and an exercise list.
- The muscle summary is horizontally scrollable with compact anatomical thumbnails, title, exercise count, and set count.
- Exercises are listed in dense rows with a small equipment thumbnail, exercise name, set prescription chips, target muscle chips, overflow menu, and small colored status badges.
- A full-width sticky bottom CTA starts the workout.

### Live Workout Logging

- The live workout screen uses a top horizontal exercise carousel with small exercise thumbnails and progress indicators.
- Each exercise section has columns for set number, previous value, weight, reps, and a completion checkbox.
- Entered values appear in compact rounded input cells.
- The right edge uses small colored markers or badges for set state and target intensity.
- The layout prioritizes repeated entry speed over explanatory text.

### Active Program and Workout Library

- A workout hub screen has a date strip across the top, an active program section, a workout library section, and a "More" section.
- Cards are compact, dark, and full-width, with an icon block at left and a chevron/dropdown affordance at right.
- The bottom navigation remains fixed with Dashboard, Workout, centered add button, Levels, and More.
- Empty workout, workout history, archive, and section customization are presented as list rows.

### Program Creation Entry

- Program creation begins with an illustrated intro panel and then a creation choice screen.
- Creation choices include guided generation, building from scratch, and file import.
- Program naming uses a plain input form with the iOS keyboard visible and a bottom CTA.
- A tabbed program builder follows, with workout days and rest days in a horizontal day strip.

### Program Builder and Exercise Search

- The builder supports rest days, workout days, target muscle summaries, exercise lists, and add-exercise actions.
- Rest days show an empty-state card explaining that adding exercises converts the day into a workout day.
- Exercise search appears as a right-side overlay or pushed panel, with filters for gym/equipment, type, and target muscles.
- Search results are grouped by category, each row containing a thumbnail, exercise name, primary muscle label, and add control.

### Exercise Options Bottom Sheet

- Exercise overflow opens a bottom sheet with a grab handle, close button, title, and action list.
- Actions visible include info, swap, superset, move to a different day, program note, duplicate, and remove.
- Rows combine an icon, primary label, secondary description, and a trailing chevron or inline button.
- Destructive actions use a red accent.

### Set Target and Rest Timer Configuration

- Exercise set configuration appears as a bottom sheet with a table-like set editor.
- Columns include set number, reps minimum, reps maximum, rest, and RIR.
- Optional fields are shown as muted rounded inputs.
- Toggles configure whether an exercise is skipped and whether custom set rest timers are enabled.
- Rest timer selection uses an iOS-style wheel picker in a nested bottom sheet.

### Dashboard

- The nutrition/dashboard interface uses a dark background with large typographic heading, date context, and card-based summaries.
- Energy balance appears as a chart card with calorie totals and expenditure/target toggles.
- Secondary cards show insights and analytics such as expenditure and trend summaries.
- A lower "More" area lists customization and data manager actions.

### Nutrition Search and Food Logging

- Food logging uses a top calorie/progress capsule, mode tabs, and a search-first workflow.
- Modes visible include scan, search, AI, quick add, and library.
- Search results show food rows with small colorful icons, food name, calorie count, macros, serving quantity, and add buttons.
- The search input is anchored near the keyboard with a prominent "Log Foods" CTA.
- Recent or suggested foods appear before typed search results.

### Quick Actions and Recipe Creation

- The centered bottom add button opens a shortcuts sheet with actions such as weight entry, scan, barcode, quick add, recipe, new recipe, edit day, and describe.
- Recipe creation uses a multi-step form with a top progress indicator.
- Fields include recipe name, serving quantity, total weight, ingredients, preparation time, cooking time, link, description, and preparation steps.
- Primary CTAs are large, bottom-aligned, and high-contrast.

## 3. Inferred Navigation Structure

- The app is organized around a fixed bottom navigation bar.
- Primary destinations visible are dashboard/food log/nutrition, workout, strategy or levels, and more.
- A prominent centered add button acts as a global quick-action launcher.
- Workout navigation branches into active program, workout library, program builder, workout day detail, exercise search, exercise options, set target editing, and live workout logging.
- Nutrition navigation branches into dashboard, food log/search, scan/search/AI/quick-add/library modes, shortcuts, recipe creation, and data management.
- Most task-specific actions are handled by bottom sheets, side overlays, or keyboard-aware forms rather than full page transitions.

## 4. Reusable UI Patterns

- Dark card-based surface hierarchy with near-black app background and slightly lighter cards.
- Fixed iPhone-style top and bottom safe-area spacing.
- Horizontal date selectors and day/program tab strips.
- Compact full-width cards with left icon blocks and right chevrons.
- Dense list rows with thumbnails, labels, metadata chips, and overflow menus.
- Bottom sheets with grab handles, close icons, clear titles, and list actions.
- Bottom-aligned full-width primary buttons.
- Pill filters and segmented controls for equipment, target muscles, day/cycle views, and nutrition modes.
- Table-like input rows for live set logging and planned set targets.
- Inline plus buttons for quick add behavior.
- Muted secondary text for estimates, descriptions, and field help.

## 5. Interaction Patterns

- Tap a bottom tab to switch primary domain.
- Tap the center quick-action button to open a shortcut sheet.
- Tap date pills to change the active day.
- Expand/collapse program cards from the workout hub.
- Tap a workout day card or exercise row to drill into workout detail.
- Tap overflow menus to open exercise-specific action sheets.
- Tap "Add Exercises" to open a searchable exercise library.
- Use filters before selecting exercises from categorized lists.
- Use bottom sheets for focused edits without losing context.
- Use sticky bottom CTAs for start, save, activate, create, and log actions.
- Use keyboard-aware search and forms, with search/submit controls kept above the keyboard.
- Use toggles for binary exercise options and picker sheets for structured values like rest time.

## 6. Active-Workout Behavior Visible in the Recording

- Live workout logging is resumable from a workout context and keeps the user inside a dense exercise-entry interface.
- A top exercise carousel shows neighboring exercises and current position.
- The active exercise has a table of sets with previous performance, editable weight/reps cells, and completion checkboxes.
- Exercise navigation appears possible through the top carousel and side controls.
- Rest-timer configuration is visible in planning/editing context, including per-set rest values.
- The recording does not clearly show the exact countdown UI during an active rest period.
- Workout completion is not clearly visible; the recording returns to other screens and eventually the phone home screen rather than showing a completed-workout summary.

## 7. Nutrition Behavior Visible in the Recording

- Nutrition has a dashboard with calorie and energy-balance summaries.
- Food logging centers on search, recent/suggested foods, and quick add flows.
- Search results show calories, protein, fat, carbs, serving multiplier, and serving unit.
- Users can add individual foods from search results using row-level add buttons.
- A "Log Foods" CTA appears after selecting or preparing to select foods.
- The shortcut sheet exposes food-related actions including scan, barcode, quick add, recipe, new recipe, edit day, and describe.
- Recipe creation supports required fields, ingredients, serving quantity, total weight, preparation metadata, and create/create-and-add paths.
- Editable serving multipliers are visible in food rows, but the recording does not clearly show the detailed serving edit dialog.

## 8. Design Tokens That Can Be Approximated

### Background Layers

- App background: near black, approximately `#101010` to `#151515`.
- Primary surface/card: dark charcoal, approximately `#1D1D1F` to `#242426`.
- Raised sheet surface: slightly lighter charcoal, approximately `#202022` to `#29292B`.
- Input fill: muted charcoal, approximately `#303033` to `#3A3A3D`.
- Dividers: low-contrast gray, approximately `#343437` to `#444448`.

### Card Treatment

- Cards are mostly full-width within 16 px side margins.
- Repeated cards use subtle contrast rather than strong borders.
- List sections use dividers inside shared surfaces.
- Primary buttons use a high-contrast white fill with black text.
- Disabled secondary buttons are gray with reduced contrast.

### Border Radii

- Small chips and inputs: about 6-10 px.
- Standard cards: about 10-14 px.
- Large bottom sheets: about 18-24 px top radius.
- Circular icon buttons and add controls: fully rounded.

### Spacing Scale

- Page side margin: about 16 px.
- Tight row gaps: about 6-8 px.
- Standard vertical gaps: about 12-16 px.
- Section gaps: about 24-32 px.
- Bottom CTA clearance: enough to sit above the home indicator and tab bar.

### Typography Scale

- Large dashboard heading: about 28-34 px, heavy weight.
- Screen title: about 17-20 px, semibold.
- Section heading: about 20-24 px, bold.
- Row title: about 15-17 px, semibold.
- Metadata/body text: about 12-14 px.
- Chips and table labels: about 11-13 px.

### Accent Usage

- Purple is used for active date states, active program icon blocks, and selected workout context.
- White is reserved for primary action buttons and selected pill states.
- Gray carries inactive tabs, dividers, disabled controls, and supporting metadata.
- Red/pink marks destructive actions, badges, or alert-like state.
- Yellow/orange appears as small status markers or target-intensity indicators.
- Blue appears in muscle-highlight diagrams and occasional system controls.

## 9. iPhone-Specific Layout Considerations

- The source viewport is portrait `884x1920`, consistent with a high-density iPhone screen recording.
- Top content must avoid the Dynamic Island/status bar area and screen broadcast indicator.
- Bottom navigation and sticky CTAs must avoid the home indicator.
- Keyboard-aware screens need to keep search fields and CTAs visible above the iOS keyboard.
- Bottom sheets should account for swipe gestures, safe-area padding, and grab-handle affordances.
- Dense workout tables should remain usable on narrow widths without horizontal scrolling where possible.
- The app should support long content under fixed top/bottom chrome with scrollable interior regions.
- Touch targets should remain large enough even when the visual design is compact.

## 10. Unclear or Unobservable Behavior

- The exact active rest countdown presentation is not clearly shown.
- Workout completion and post-workout summary behavior are not clearly shown.
- Program-change review or detected-change checklist behavior is not clearly shown.
- Detailed serving multiplier editing is implied by food rows but not clearly demonstrated.
- Offline/local-first behavior is not visible.
- Error states, loading states, empty nutrition states, and conflict resolution are not visible.
- Authentication, onboarding, settings, data export, and privacy flows are not visible.
- Accessibility behavior such as dynamic type, reduce motion, and VoiceOver labels is not visible.
- Tablet or desktop responsive behavior is not visible.

## 11. Patterns to Adapt, Not Copy.

- Adapt the dark, dense, card-based mobile information architecture.
- Adapt the fixed bottom navigation with a prominent center quick-action button.
- Adapt the dashboard pattern: date selection, calorie/macros, current program, latest workout, start/resume workout, and bodyweight entry.
- Adapt the workout hub pattern: active program, compact program library, selectable workout-day cards, and resumable live workout.
- Adapt the live workout pattern: exercise carousel, set-entry table, completion controls, rest timer affordances, and quick exercise navigation.
- Adapt the nutrition pattern: searchable food log, recent foods, serving multipliers, macro summaries, quick add, and recipe creation.
- Adapt bottom-sheet actions for exercise options, shortcuts, food actions, and compact review flows.
- For unobserved program-change review behavior, use a compact detected-change checklist rather than copying any unseen branded flow.
- Use original icons, neutral naming, and original illustration/art direction.
- Preserve the interaction intent and ergonomic density, but implement a distinct visual system suited to this app.
