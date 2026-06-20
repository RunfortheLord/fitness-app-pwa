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

- `GET /api/foods/search`
- `GET /api/foods/resolve`

Search parameters:

- `q`: required, trimmed, repeated whitespace normalized, minimum 2 characters, maximum 80 characters.
- `provider`: optional `usda`, `open_food_facts`, or `all`; defaults to `usda`.
- `page`: optional integer 1 through 20.
- `pageSize`: optional integer 1 through 50.
- `allowFallback`: optional `true`; enables controlled Open Food Facts fallback after no acceptable USDA results.

Resolve parameters:

- `provider`: currently `usda`.
- `providerRecordId`: USDA FDC numeric ID.

The routes return normalized application records only. They do not forward raw provider payloads, accept arbitrary upstream URLs, or expose provider credentials.

The Vercel server functions import server and domain modules through relative
paths so they do not depend on Vite-only path alias resolution. If a deployed
API route returns the SPA HTML shell instead of JSON, the client reports a typed
API-routing misconfiguration instead of a generic provider failure.

## Environment

Required server-only variable:

- `USDA_FDC_API_KEY`

Local development:

1. Copy `.env.example` to `.env.local`.
2. Set `USDA_FDC_API_KEY` to a USDA FoodData Central API key.
3. Do not use a `VITE_` prefix for this value.

Vercel preview and production:

1. Add `USDA_FDC_API_KEY` in the Vercel project environment variables for Preview and Production.
2. Redeploy after changing the variable.

When the variable is missing, provider search returns `server_missing_configuration`. Existing local nutrition logging remains usable and the client app should not crash. Automated tests use mocked fetchers and do not need a real key.

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

Provider serving units are preserved. Grams and mass ounces convert only when a reliable provider gram weight exists. Fluid ounces remain a volume unit and are not converted to grams without density. Volume servings without reliable weight stay unconverted. Precision is retained internally and display code should round only for presentation.

## Raw/Cooked And Ranking

Raw/cooked classification is conservative. It uses controlled whole-word markers such as raw, uncooked, cooked, roasted, grilled, baked, boiled, fried, broiled, and steamed. Incidental substrings do not classify a food. Cooked meat-like entries receive a small ranking boost over equivalent raw entries, but raw entries remain searchable.

## Duplicate Grouping

Duplicate grouping is deterministic and conservative. It compares normalized name, normalized brand or restaurant, serving quantity and unit, reliable gram equivalence, macro similarity, raw/cooked status, and provider data type. Alternates are retained by ID for the next UI prompt. Different brands, flavors, fat percentages, raw/cooked states, and non-equivalent serving sizes are not merged.

## Cache Behavior

Server code caches normalized results in process memory with explicit TTL and bounded size. Search keys include provider, normalized query, pagination, and fallback state. Open Food Facts has a stricter cache and concurrent identical fallback calls are coalesced. Error responses are not cached indefinitely by the normalized result cache.

This cache is best-effort in serverless environments. Instances may be cold-started or evicted, and caches are not shared across all Vercel regions or invocations. Dynamic provider responses are not added to the service-worker precache.

## Offline And Historical Integrity

When an external food is logged, the app stores an immutable snapshot containing provider identity, serving data, conversion metadata, macros, macro basis, raw/cooked status, source update timestamp, ingestion timestamp, log timestamp, and normalizer version. Historical totals are computed from the snapshot, not a future provider lookup. Provider outages, provider deletion, cache eviction, or provider data changes do not affect existing logs.

Previously used provider foods may be retained in the local IndexedDB `foods` table for reuse. Provider foods are separate from custom foods and cannot be edited directly. A corrected version is represented as a separate private custom food through the Custom copy action. Custom foods remain local and are never submitted to USDA, Open Food Facts, or another shared database.

## Search UI Behavior

The Nutrition screen searches local recent, custom, and previously used foods immediately. Remote provider search starts only after at least two normalized characters, is debounced, and cancels stale requests. The UI calls USDA through the provider-independent client service with controlled fallback enabled; Open Food Facts is reached only through the server-side fallback policy after no acceptable USDA results.

Collapsed search rows show food name, optional brand or restaurant, serving size, and calories. Selecting a row opens details with calories, protein, total carbohydrates, fat, editable serving amount, and available serving units. Gram and mass-ounce options appear only when the normalized record has reliable gram conversion metadata.

Provider duplicate groups show the primary representative first and expose alternates through a compact More Results control.

## Security

The USDA key is read only by Vercel server functions. Browser code uses same-origin API calls and never imports the key. API inputs are bounded and validated, provider base URLs are fixed server-side, raw provider errors are not reflected to clients, and raw provider payloads are not forwarded wholesale. The production build runs a sentinel scan to fail if the known test secret appears in generated assets, service-worker output, manifest, or source maps.

## Known Limitations

- Live provider verification requires a real USDA key and was not performed unless a key is already configured securely.
- Open Food Facts data is community-contributed and may be incomplete or inaccurate.
- Restaurant and fast-food coverage is limited to records supplied by allowed providers.
- Barcode scanning, barcode submission, and offline remote-provider search are deferred.
