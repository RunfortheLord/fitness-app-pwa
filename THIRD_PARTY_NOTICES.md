# Third-Party Notices

## Built-in exercise library

- Source: Original curated seed list created for this project.
- License: Project-owned original factual exercise names and classifications; no third-party exercise database, application code, images, videos, instructions, or descriptions were imported.
- Retrieval date: Not applicable. The list was authored locally on 2026-06-19.
- Transformations: Names were normalized into stable `builtin:` IDs and categorized by equipment, primary/secondary muscle groups, tracking method, unilateral repetition behavior, default rest duration, and default weight increment.

## USDA FoodData Central

- Official source: FoodData Central API and data type documentation, https://fdc.nal.usda.gov/.
- Verification date: 2026-06-19.
- License: FoodData Central data is public domain and published under CC0 1.0 Universal.
- Attribution: USDA requests that applications list FoodData Central as the data source. Suggested citation: U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central. Available from https://fdc.nal.usda.gov/.
- Access method: Server-side Vercel functions call the official API with `USDA_FDC_API_KEY`.
- Retained locally: Normalized provider identity, source name, source reference, source update timestamp, serving data, required macros, raw/cooked status, and immutable logged-food snapshots.
- Transformations: Provider records are normalized to the app food model, required macro completeness is validated, servings are converted only when reliable gram weights exist, and duplicate grouping metadata is derived.
- Limitations: USDA records vary by data type and do not provide complete restaurant or fast-food coverage.

## Open Food Facts

- Official source: Open Food Facts API and reuse documentation, https://openfoodfacts.github.io/openfoodfacts-server/api/ and https://wiki.openfoodfacts.org/Reusing_Open_Food_Facts_Data.
- Verification date: 2026-06-19.
- License: Open Food Facts database data is available under the Open Database License; database contents are available under the Database Contents License. Product images use Creative Commons Attribution ShareAlike and are not used by this app.
- Attribution: Open Food Facts attribution is required when Open Food Facts data is used.
- Access method: Controlled server-side fallback only, with a custom identifying User-Agent. The app performs read operations only.
- Retained locally: Normalized branded product identity, optional barcode metadata, source URL, source update timestamp, serving data, required macros, and immutable logged-food snapshots.
- Transformations: Records missing calories, protein, total carbohydrates, or fat are excluded. Explicit kilojoules may be converted to kilocalories when no kcal field is supplied. Nutrition grades, scores, images, and incomplete community data are not used.
- Limitations: Data is community-contributed and may be incomplete or inaccurate. Open Food Facts is not used for search-as-you-type and the app does not write or submit products.
