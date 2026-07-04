import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Flame,
  Search,
  Trash2,
} from 'lucide-react'

import {
  EmptyState,
  IconButton,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { FoodIcon } from '@components/FoodIcon'
import { FoodCameraMenu } from '@components/FoodCameraMenu'
import {
  formatAmountValue,
  formatCalories,
  formatMacroGram,
} from '@domain/foodServings'
import { normalizeProviderQuery } from '@domain/foodProviderModels'
import type { FoodSearchResult } from '@domain/foodSearchSections'
import type { Food, FoodUnitPreference } from '@shared-types/app'

import { FoodLibraryRow } from './FoodLibraryRow'
import { resultKey } from './foodDisplay'
import { roundMacro } from './nutritionForms'
import type { AddedItem, ProviderSearchState, RecipeDraft } from './types'

export function FoodSearchSubpage({
  providerSearch,
  results,
  foodUnitPreferences,
  addedItems,
  recipeDraft,
  recipeError,
  recipeSaving,
  saveAiRecipe,
  onRecipeNameChange,
  onRemoveRecipeComponent,
  onOpenRecipeComponent,
  onLogAiRecipe,
  onSaveRecipe,
  onToggleSaveAiRecipe,
  onBack,
  onEditFood,
  onOpenAiCamera,
  onOpenQuickAdd,
  onOpenScanner,
  onOpenRecipe,
  onOpenAddedItem,
  onSelectResult,
  onAddResult,
  onSearch,
  query,
  setQuery,
}: {
  providerSearch: ProviderSearchState
  results: Array<{ title: string; items: FoodSearchResult[] }>
  foodUnitPreferences: Record<string, FoodUnitPreference>
  addedItems: AddedItem[]
  recipeDraft: RecipeDraft | null
  recipeError: string | null
  recipeSaving: boolean
  saveAiRecipe: boolean
  onRecipeNameChange: (name: string) => void
  onRemoveRecipeComponent: (index: number) => void
  onOpenRecipeComponent: (index: number) => void
  onLogAiRecipe: () => void
  onSaveRecipe: () => void
  onToggleSaveAiRecipe: () => void
  onBack: () => void
  onEditFood: (food: Food) => void
  onOpenAiCamera: () => void
  onOpenQuickAdd: () => void
  onOpenScanner: () => void
  onOpenRecipe: () => void
  onOpenAddedItem: (entryId: string) => void
  onSelectResult: (result: FoodSearchResult) => void
  onAddResult: (result: FoodSearchResult) => void
  onSearch: () => void
  query: string
  setQuery: (query: string) => void
}) {
  const { language, t } = useLanguage()
  const hasResults = results.some((section) => section.items.length > 0)
  const normalizedQuery = normalizeProviderQuery(query)
  const providerSearchBlocksEmptyState =
    providerSearch.status === 'loading' ||
    providerStatusMessage(providerSearch.status) !== null
  const recipeMode = recipeDraft !== null
  const recipeCalories =
    recipeDraft?.components.reduce(
      (total, component) =>
        total +
        component.foodSnapshot.caloriesPerServing * component.servingMultiplier,
      0,
    ) ?? 0

  return (
    <div className="food-search-subpage subpage-enter">
      <div className="food-search-sticky">
        <div className="food-search-subpage-bar">
          <IconButton aria-label="Back to nutrition" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <div className="food-search-subpage-input">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label={t('Search foods')}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onSearch()
                }
              }}
              placeholder={t('Search foods')}
              type="search"
              value={query}
            />
          </div>
          {language === 'es' ? (
            <IconButton aria-label="Search Spanish foods" onClick={onSearch}>
              <Search aria-hidden="true" size={20} />
            </IconButton>
          ) : null}
          <div className="row-actions">
            {recipeMode ? (
              <span
                className="recipe-mode-badge"
                aria-label={t('Building a recipe')}
              >
                <BookmarkPlus aria-hidden="true" size={20} />
              </span>
            ) : (
              <>
                <IconButton
                  aria-label="Quick add nutrition"
                  onClick={onOpenQuickAdd}
                >
                  <Flame aria-hidden="true" size={20} />
                </IconButton>
                <IconButton aria-label="New recipe" onClick={onOpenRecipe}>
                  <BookmarkPlus aria-hidden="true" size={20} />
                </IconButton>
              </>
            )}
            <FoodCameraMenu
              onOpenAiCamera={onOpenAiCamera}
              onOpenScanner={onOpenScanner}
            />
          </div>
        </div>
        {recipeMode && recipeDraft ? (
          <div className="recipe-build-bar" aria-label={t('Recipe builder')}>
            {recipeDraft.source === 'gemini' ? (
              <p
                aria-label={t('Estimated total calories')}
                className="ai-recipe-calorie-total"
              >
                <span>{t('Calories')}:</span>{' '}
                <strong>{roundMacro(recipeCalories)}</strong>
              </p>
            ) : null}
            <div className="food-search-subpage-input">
              <BookmarkPlus aria-hidden="true" size={18} />
              <input
                aria-label={t('Recipe name')}
                onChange={(event) => onRecipeNameChange(event.target.value)}
                placeholder={t('Recipe name')}
                type="text"
                value={recipeDraft.name}
              />
            </div>
            {recipeDraft.components.length ? (
              <div className="recipe-build-components">
                {recipeDraft.components.map((component, index) => (
                  <div
                    className="recipe-ingredient-row"
                    key={`${component.foodId ?? component.foodSnapshot.foodName}-${index}`}
                  >
                    <button
                      aria-label={t('Edit {name} ingredient', {
                        name: component.foodSnapshot.foodName,
                      })}
                      className="recipe-ingredient-main"
                      onClick={() => onOpenRecipeComponent(index)}
                      type="button"
                    >
                      <FoodIcon
                        name={component.foodSnapshot.foodName}
                        size={34}
                      />
                      <span className="recipe-ingredient-copy">
                        <strong>{component.foodSnapshot.foodName}</strong>
                        <small>
                          {formatAmountValue(
                            component.foodSnapshot.servingQuantity *
                              component.servingMultiplier,
                          )}{' '}
                          {component.foodSnapshot.servingUnit}
                        </small>
                        <small>
                          {formatCalories(
                            component.foodSnapshot.caloriesPerServing *
                              component.servingMultiplier,
                          )}{' '}
                          kcal · P{' '}
                          {formatMacroGram(
                            component.foodSnapshot.proteinGramsPerServing *
                              component.servingMultiplier,
                          )}{' '}
                          C{' '}
                          {formatMacroGram(
                            component.foodSnapshot.carbohydrateGramsPerServing *
                              component.servingMultiplier,
                          )}{' '}
                          F{' '}
                          {formatMacroGram(
                            component.foodSnapshot.fatGramsPerServing *
                              component.servingMultiplier,
                          )}
                        </small>
                      </span>
                    </button>
                    <button
                      aria-label={`Remove ${component.foodSnapshot.foodName}`}
                      className="recipe-ingredient-remove"
                      onClick={() => onRemoveRecipeComponent(index)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted recipe-build-hint">
                {t('Search foods below and add them to this recipe.')}
              </p>
            )}
            {recipeDraft.components.length &&
            recipeDraft.source !== 'gemini' ? (
              <p className="muted recipe-build-total">
                {t('Total')}: {roundMacro(recipeCalories)} kcal
              </p>
            ) : null}
            {recipeDraft.source === 'gemini' && recipeDraft.notes ? (
              <p className="muted recipe-build-notes">{recipeDraft.notes}</p>
            ) : null}
            {recipeError ? <ValidationMessage message={recipeError} /> : null}
            {recipeDraft.source === 'gemini' ? (
              <div className="ai-recipe-actions">
                <button
                  aria-checked={saveAiRecipe}
                  className="recipe-save-toggle"
                  onClick={onToggleSaveAiRecipe}
                  role="checkbox"
                  type="button"
                >
                  <span aria-hidden="true" className="recipe-save-checkmark">
                    <Check size={18} strokeWidth={3} />
                  </span>
                  {t('Save as recipe')}
                </button>
                <PrimaryButton
                  disabled={recipeSaving}
                  onClick={onLogAiRecipe}
                  type="button"
                >
                  {recipeSaving
                    ? 'Logging…'
                    : `Log food (${recipeDraft.components.length})`}
                </PrimaryButton>
              </div>
            ) : (
              <PrimaryButton
                disabled={recipeSaving}
                onClick={onSaveRecipe}
                type="button"
              >
                {recipeSaving
                  ? 'Saving…'
                  : `${recipeDraft.editingId ? 'Update' : 'Save'} recipe${
                      recipeDraft.components.length
                        ? ` (${recipeDraft.components.length})`
                        : ''
                    }`}
              </PrimaryButton>
            )}
          </div>
        ) : addedItems.length ? (
          <div className="added-items-tray" aria-label={t('Items added')}>
            <div className="added-items-row">
              {addedItems.map((item) => (
                <button
                  aria-label={t('Edit {name} serving', { name: item.name })}
                  className="added-item-chip"
                  key={item.id}
                  onClick={() => onOpenAddedItem(item.entryId)}
                  title={item.name}
                  type="button"
                >
                  <FoodIcon
                    name={item.iconName}
                    category={item.iconCategory}
                    size={18}
                  />
                </button>
              ))}
            </div>
            <button className="added-items-done" type="button" onClick={onBack}>
              {t('{count} added · Done', { count: addedItems.length })}
            </button>
          </div>
        ) : null}
      </div>

      <div className="food-search-subpage-body">
        <ProviderSearchStatus
          state={providerSearch}
          query={normalizedQuery}
          onRetry={onSearch}
        />
        {language === 'es' &&
        normalizedQuery.length >= 3 &&
        providerSearch.query !== normalizedQuery ? (
          <p className="muted" role="status">
            {t('Tap the search button to search Spanish food products.')}
          </p>
        ) : null}

        {hasResults ? (
          <div className="nutrition-search-sections">
            {results.map((section) =>
              section.items.length ? (
                <section
                  aria-label={t(section.title)}
                  className="nutrition-result-section"
                  key={section.title}
                >
                  <h3>{t(section.title)}</h3>
                  <div className="nutrition-list">
                    {section.items.map((result) => (
                      <FoodLibraryRow
                        key={resultKey(result)}
                        result={result}
                        rememberedServing={
                          result.type === 'local'
                            ? foodUnitPreferences[result.food.id]
                            : null
                        }
                        onEdit={
                          result.type === 'local' &&
                          result.food.sourceType !== 'provider'
                            ? () => onEditFood(result.food)
                            : null
                        }
                        onSelect={() => onSelectResult(result)}
                        onAdd={() => onAddResult(result)}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        ) : providerSearchBlocksEmptyState ? null : (
          <EmptyState
            title={normalizedQuery ? 'No acceptable results' : 'Search foods'}
            message={
              normalizedQuery
                ? 'No local or provider foods with calories, protein, total carbohydrates, and fat matched.'
                : language === 'es'
                  ? 'Search local foods and Spanish Open Food Facts products by name or brand.'
                  : 'Search local foods and USDA provider foods by name, brand, or restaurant.'
            }
          />
        )}
      </div>
    </div>
  )
}

function ProviderSearchStatus({
  onRetry,
  query,
  state,
}: {
  onRetry: () => void
  query: string
  state: ProviderSearchState
}) {
  if (!query) {
    return null
  }
  if (state.status === 'below-threshold') {
    return (
      <p className="muted" role="status">
        Type at least 3 characters to search remote foods. Local foods still
        appear when they match.
      </p>
    )
  }
  if (state.status === 'loading') {
    return <LoadingState label="Searching food providers" />
  }
  if (state.status === 'ready') {
    return null
  }

  const message = providerStatusMessage(state.status)
  return message ? (
    <StatusMessage tone="warning">
      <div className="status-message-content">
        <span>{message}</span>
        <SecondaryButton type="button" onClick={onRetry}>
          Retry
        </SecondaryButton>
      </div>
    </StatusMessage>
  ) : null
}

function providerStatusMessage(status: ProviderSearchState['status']) {
  switch (status) {
    case 'offline':
      return 'Remote food search needs a connection. Recent, custom, and previously used foods are still available.'
    case 'missing_api_key':
      return 'API key missing. Add a USDA API key in Settings to enable remote search.'
    case 'invalid_api_key':
      return 'API key invalid. Manage the USDA key in Settings.'
    case 'provider_timeout':
      return 'Food provider search timed out. Local foods and history are still available.'
    case 'provider_unavailable':
      return 'Food providers are unavailable right now. Local foods and history are still available.'
    case 'provider_rate_limited':
      return 'Food providers are rate limited right now. Try again later.'
    case 'server_missing_configuration':
      return 'USDA search is not configured.'
    case 'api_route_misconfigured':
      return 'Food provider API routing is misconfigured on this deployment.'
    case 'normalization_failure':
      return 'Food provider results could not be normalized.'
    case 'unexpected_server_error':
      return 'Food provider search failed unexpectedly.'
    case 'invalid_request':
    case 'query_too_short':
    case 'no_acceptable_results':
    case 'idle':
    case 'below-threshold':
    case 'loading':
    case 'ready':
      return null
  }
}
