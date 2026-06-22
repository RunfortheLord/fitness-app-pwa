# Food Provider Integration

Verification date: 2026-06-19.

## Sources Reviewed

- USDA FoodData Central API Guide: https://fdc.nal.usda.gov/api-guide
- USDA FoodData Central data type documentation: https://fdc.nal.usda.gov/data-documentation
- USDA FoodData Central licensing page: https://fdc.nal.usda.gov/
- Open Food Facts API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Open Food Facts data reuse documentation: https://wiki.openfoodfacts.org/Reusing_Open_Food_Facts_Data
- Open Food Facts API conditions: https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api

## Provider Decisions

USDA FoodData Central is the primary provider. The integration uses the official API through server-side Vercel functions and supports Foundation, SR Legacy, Survey (FNDDS), and Branded search records when they include calories, protein, total carbohydrates, and fat.

Open Food Facts is a controlled secondary provider for branded-product fallback. It is not called for every typed query and is not used as a search-as-you-type endpoint. Fallback occurs only when explicitly requested or when a server-controlled USDA search with fallback enabled returns no acceptable normalized records. The app does not write to Open Food Facts, upload user-created foods, upload missing barcodes, or depend on product images, nutrition grades, or scores.

No third provider was accepted in this prompt. Restaurant and fast-food coverage is limited to records that USDA or a permitted fallback actually supplies. The app does not scrape menus and does not fabricate restaurant coverage.

## Licensing And Attribution

USDA FoodData Central data is public domain and published under CC0 1.0 Universal. USDA requests source attribution. The app records USDA as the source name on normalized records and notices.

Open Food Facts database data is available under the Open Database License, with database contents under the Database Contents License. Product images use Creative Commons Attribution ShareAlike and are intentionally not used. Open Food Facts requires attribution and a custom User-Agent for API calls. The server sends an identifying User-Agent.

## API Routes

- `POST /api/foods/test-key`
- `POST /api/foods/search`
- `POST /api/foods/details`
- `POST /api/foods/barcode`

Search parameters:

- `query`: required, trimmed, repeated whitespace normalized, minimum 3 characters, maximum 80 characters.
- `provider`: optional `usda`, `open_food_facts`, or `all`; defaults to `usda`.
- `page`: optional integer 1 through 20.
- `pageSize`: optional integer 1 through 50.
- `allowFallback`: optional `true`; enables controlled Open Food Facts fallback after no acceptable USDA results.

Resolve parameters:

- `provider`: currently `usda`.
- `providerRecordId`: USDA FDC numeric ID.

Barcode lookup parameters:

- `barcode`: UPC/EAN digits, 8 through 14 characters.

Barcode lookup searches USDA branded foods and Open Food Facts. When both
providers return complete but conflicting records, USDA is preferred. Open Food
Facts is used as fallback or supplementary data only; values are not averaged.
Successful barcode results are normalized into the app food model and cached in
local IndexedDB so the same scanned product can be reopened offline.

The routes return normalized application records only. They do not forward raw provider payloads, accept arbitrary upstream URLs, or expose provider credentials.

The Vercel server functions import server and domain modules through relative
paths so they do not depend on Vite-only path alias resolution. If a deployed
API route returns the SPA HTML shell instead of JSON, the client reports a typed
API-routing misconfiguration instead of a generic provider failure.

## API Key Handling

The app no longer uses a Vercel-stored USDA key. The user enters their own USDA
FoodData Central key under Settings -> Integrations -> USDA FoodData Central.
The PWA stores that key only in device-local IndexedDB and sends it over HTTPS
to the same-origin Vercel function for the current request. The function does
not log, cache, persist, or return the key.

The key is not included in source constants, VITE environment variables,
deployment settings, backups, CSV exports, diagnostics, console logs, or raw
errors. Removing or replacing the key deletes or updates only the integration
settings record. Clearing all local app data or replacing data from backup also
removes the saved integration key.

## Normalized Food Schema

Provider records normalize to a canonical model with:

- Stable ID derived from provider and provider record ID.
- Provider, provider record ID, data type, source name, optional source URL, optional GTIN/barcode metadata, source update timestamp, ingestion timestamp, and normalizer version.
- Name, optional brand or restaurant/manufacturer, optional category, raw/cooked status, and raw/cooked basis.
- Serving quantity, provider unit, serving description, reliable grams per serving when supplied, derived mass ounces when grams are reliable, source portions, conversion reliability, and conversion source.
- Calories, protein, total carbohydrates, and fat per serving and/or per 100 grams when reliably derivable.
- Normalized search name, normalized brand, provider priority, duplicate group ID, alternate IDs, and grouping reasons.

Mutable UI state and prior-use ranking stay outside provider identity.

## Macro Rules

External provider foods are searchable only when all four required macros are usable:

- Calories
- Protein
- Total carbohydrates
- Fat

Zero is valid. Null, undefined, blank, nonnumeric, NaN, Infinity, negative, and clearly malformed values are invalid. Net carbohydrates, fiber, added sugars, saturated fat, nutrition grades, and nutrition scores are never substituted for total carbohydrates or another required macro.

USDA nutrient extraction prefers nutrient IDs:

- `1008` Energy kcal
- `1003` Protein
- `1005` Carbohydrate, by difference
- `1004` Total lipid/fat

Open Food Facts extraction uses explicit kcal fields when present and converts explicit kilojoule fields only when kcal is absent. Generic energy fields are not treated as kcal.

## Serving And Conversion

Provider serving units are preserved. Practical household defaults are selected
for common foods when a reliable weight or source portion exists: cooked chicken
breast defaults to 4 oz cooked, raw chicken breast defaults to 4 oz raw, cooked
rice defaults to 1 cup, meat and fish prefer ounces, and branded products prefer
their label serving. Grams, mass ounces, and 100 g remain available as secondary
units when reliable conversion data exists. Fluid ounces remain a volume unit
and are not converted to grams without density. Volume servings without
reliable weight stay unconverted. Precision is retained internally and display
code should round only for presentation.

## Raw/Cooked And Ranking

Raw/cooked classification is conservative. It uses controlled whole-word markers such as raw, uncooked, cooked, roasted, grilled, baked, boiled, fried, broiled, and steamed. Incidental substrings do not classify a food. Cooked meat-like entries receive a small ranking boost over equivalent raw entries, but raw entries remain searchable.

## Duplicate Grouping

Duplicate grouping is deterministic and conservative. It compares normalized name, normalized brand or restaurant, serving quantity and unit, reliable gram equivalence, macro similarity, raw/cooked status, and provider data type. Alternates are retained by ID for the next UI prompt. Different brands, flavors, fat percentages, raw/cooked states, and non-equivalent serving sizes are not merged.

## Cache Behavior

Server code caches Open Food Facts fallback results in process memory with
explicit TTL and bounded size. USDA searches are executed per request with the
user-supplied key and are not stored in the shared normalized result cache.
Concurrent identical Open Food Facts fallback calls are coalesced.

This cache is best-effort in serverless environments. Instances may be cold-started or evicted, and caches are not shared across all Vercel regions or invocations. Dynamic provider responses are not added to the service-worker precache.

## Offline And Historical Integrity

When an external food is logged, the app stores an immutable snapshot containing provider identity, serving data, conversion metadata, macros, macro basis, raw/cooked status, source update timestamp, ingestion timestamp, log timestamp, and normalizer version. Historical totals are computed from the snapshot, not a future provider lookup. Provider outages, provider deletion, cache eviction, or provider data changes do not affect existing logs.

Previously used provider foods may be retained in the local IndexedDB `foods` table for reuse. Provider foods are separate from custom foods and cannot be edited directly. A corrected version is represented as a separate private custom food through the Custom copy action. Custom foods remain local and are never submitted to USDA, Open Food Facts, or another shared database.

## Search UI Behavior

The Nutrition screen searches local recent, custom, and previously used foods immediately. Remote USDA search starts only after at least three normalized characters, is debounced, requires a configured key, and cancels stale requests. Broad generic searches rank common generic foods and cooked preparations ahead of branded or restaurant items, and hide uncommon animal parts unless the query asks for them.

Collapsed search rows show food name, optional brand or restaurant, serving size, and calories. Selecting a row opens details with calories, protein, total carbohydrates, fat, editable serving amount, and available serving units. Gram and mass-ounce options appear only when the normalized record has reliable gram conversion metadata.

Provider duplicate groups show the primary representative first and expose alternates through a compact More Results control. Barcode scans open a confirmation flow and never immediately log food. Unknown barcodes open the custom-food form with the barcode associated locally.

## Security

Browser code never bundles a USDA key. API inputs are bounded and validated,
provider base URLs are fixed server-side, raw provider errors are not reflected
to clients, and raw provider payloads are not forwarded wholesale. The
production build runs a sentinel scan to fail if the known test secret appears
in generated assets, service-worker output, manifest, or source maps.

## Known Limitations

- Live provider verification requires a real USDA key and was not performed unless a key is already configured securely.
- Open Food Facts data is community-contributed and may be incomplete or inaccurate.
- Restaurant and fast-food coverage is limited to records supplied by allowed providers.
- Physical-device camera behavior depends on browser permission support.
  iPhone locked-screen scanning and audio playback are not guaranteed by Safari
  PWA policies.
