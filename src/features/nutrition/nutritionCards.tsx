import {
  BookmarkPlus,
  Edit2,
  Flame,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Utensils,
} from 'lucide-react'

import { Card, EmptyState, IconButton, SecondaryButton } from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { FoodCameraMenu } from '@components/FoodCameraMenu'
import { groupEntriesByMeal } from '@domain/meals'
import type { DailyNutritionSummary } from '@services/nutritionSummaryService'
import type {
  Food,
  FoodLogEntry,
  FoodUnitPreference,
  SavedMeal,
} from '@shared-types/app'

import { FoodLibraryRow } from './FoodLibraryRow'
import { formatLoggedAmount, savedMealCalories } from './foodDisplay'
import { roundMacro } from './nutritionForms'

export function DailyTotalsCard({
  summary,
}: {
  summary: DailyNutritionSummary | null
}) {
  const { t } = useLanguage()
  const totals = summary?.totals
  const targets = summary?.targets

  return (
    <Card title="Daily nutrition totals">
      <p className="metric-value">{Math.round(totals?.calories ?? 0)} kcal</p>
      <p className="muted">
        {t('{calories} kcal remaining', {
          calories: Math.round(summary?.remainingCalories ?? 0),
        })}
      </p>
      <div className="macro-row nutrition-row">
        <span>
          {t('Protein')} {roundMacro(totals?.proteinGrams)} /{' '}
          {roundMacro(targets?.proteinGrams)} g
        </span>
        <span>
          {t('Carbs')} {roundMacro(totals?.carbohydrateGrams)} /{' '}
          {roundMacro(targets?.carbohydrateGrams)} g
        </span>
        <span>
          {t('Fat')} {roundMacro(totals?.fatGrams)} /{' '}
          {roundMacro(targets?.fatGrams)} g
        </span>
      </div>
      {!targets?.calories ? (
        <p className="muted">{t('Set manual targets when you are ready.')}</p>
      ) : null}
    </Card>
  )
}

// Day/Foods tabs show this compact card; tapping it opens the full search
// subpage. Quick add and barcode scan stay reachable here without a detour.
export function FoodSearchTrigger({
  onOpen,
  onOpenAiCamera,
  onOpenQuickAdd,
  onOpenScanner,
  onOpenRecipe,
}: {
  onOpen: () => void
  onOpenAiCamera: () => void
  onOpenQuickAdd: () => void
  onOpenScanner: () => void
  onOpenRecipe: () => void
}) {
  const { t } = useLanguage()
  return (
    <Card className="food-search-card">
      <div className="food-search-heading">
        <h2>{t('Log food')}</h2>
      </div>
      <button className="food-search-trigger" type="button" onClick={onOpen}>
        <Search aria-hidden="true" size={18} />
        <span>{t('Search foods')}</span>
      </button>
      <div className="food-search-action-strip" aria-label={t('Food actions')}>
        <SecondaryButton
          aria-label="Quick add nutrition"
          type="button"
          onClick={onOpenQuickAdd}
        >
          <Flame aria-hidden="true" size={18} />
          {t('Quick add')}
        </SecondaryButton>
        <SecondaryButton
          aria-label="New recipe"
          type="button"
          onClick={onOpenRecipe}
        >
          <BookmarkPlus aria-hidden="true" size={18} />
          {t('Recipe')}
        </SecondaryButton>
        <div className="food-camera-action">
          <FoodCameraMenu
            onOpenAiCamera={onOpenAiCamera}
            onOpenScanner={onOpenScanner}
          />
          <span>{t('Scan / AI')}</span>
        </div>
      </div>
    </Card>
  )
}

export function NutritionActionCard({
  onCreateFood,
}: {
  onCreateFood: () => void
}) {
  const { t } = useLanguage()
  return (
    <Card>
      <button
        className="nutrition-action-row"
        type="button"
        onClick={onCreateFood}
      >
        <span className="quick-action-icon">
          <ReceiptText aria-hidden="true" size={18} />
        </span>
        <span>
          <strong>{t('Create custom food')}</strong>
          <small>{t('Save a reusable food with calories and macros.')}</small>
        </span>
      </button>
    </Card>
  )
}

// Cap the recent foods list so the section stays a short, scannable shortcut.
const RECENT_FOODS_DISPLAY_CAP = 7

export function FoodShortcutCard({
  title,
  foods,
  foodUnitPreferences,
  emptyTitle,
  emptyMessage,
  onSelect,
  onQuickLog,
  onToggleFavorite,
}: {
  title: string
  foods: Food[]
  foodUnitPreferences: Record<string, FoodUnitPreference>
  emptyTitle: string
  emptyMessage: string
  onSelect: (food: Food) => void
  onQuickLog: (food: Food) => void
  onToggleFavorite: (food: Food) => void
}) {
  const visibleFoods = foods.slice(0, RECENT_FOODS_DISPLAY_CAP)
  return (
    <Card title={title}>
      {visibleFoods.length ? (
        <div className="nutrition-list">
          {visibleFoods.map((food) => (
            <FoodLibraryRow
              key={food.id}
              result={{
                type: 'local',
                food,
                section: food.sourceType === 'provider' ? 'used' : 'recent',
              }}
              rememberedServing={foodUnitPreferences[food.id]}
              onEdit={null}
              onSelect={() => onSelect(food)}
              isFavorite={Boolean(food.isFavorite)}
              onToggleFavorite={() => onToggleFavorite(food)}
              onQuickLog={() => onQuickLog(food)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      )}
    </Card>
  )
}

export function SavedMealsCard({
  meals,
  onLog,
  onEdit,
  onDelete,
}: {
  meals: SavedMeal[]
  onLog: (meal: SavedMeal) => void
  onEdit: (meal: SavedMeal) => void
  onDelete: (meal: SavedMeal) => void
}) {
  return (
    <Card title="Saved meals">
      <div className="nutrition-list">
        {meals.map((meal) => (
          <div className="nutrition-item" key={meal.id}>
            <span className="quick-action-icon">
              <Utensils aria-hidden="true" size={18} />
            </span>
            <div>
              <strong>{meal.name}</strong>
              <small>
                {meal.components.length}{' '}
                {meal.components.length === 1 ? 'item' : 'items'} -{' '}
                {roundMacro(savedMealCalories(meal))} kcal
              </small>
            </div>
            <div className="row-actions">
              <IconButton
                aria-label={`Edit saved meal ${meal.name}`}
                onClick={() => onEdit(meal)}
              >
                <Edit2 aria-hidden="true" size={18} />
              </IconButton>
              <IconButton
                aria-label={`Delete saved meal ${meal.name}`}
                onClick={() => onDelete(meal)}
              >
                <Trash2 aria-hidden="true" size={18} />
              </IconButton>
              <IconButton
                aria-label={`Log saved meal ${meal.name}`}
                onClick={() => onLog(meal)}
              >
                <Plus aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function LoggedFoodsCard({
  entries,
  onDelete,
  onEdit,
}: {
  entries: FoodLogEntry[]
  onDelete: (entry: FoodLogEntry) => void
  onEdit: (entry: FoodLogEntry) => void
}) {
  const { t } = useLanguage()
  const mealGroups = groupEntriesByMeal(entries)
  return (
    <Card title="Logged foods">
      {mealGroups.length ? (
        <div className="meal-groups">
          {mealGroups.map((group) => (
            <section className="meal-group" key={group.mealType}>
              <header className="meal-group-header">
                <h3>{t(group.label)}</h3>
                <span className="muted">
                  {roundMacro(group.calories)} kcal - P{' '}
                  {roundMacro(group.proteinGrams)} C{' '}
                  {roundMacro(group.carbohydrateGrams)} F{' '}
                  {roundMacro(group.fatGrams)}
                </span>
              </header>
              <div className="nutrition-list">
                {group.entries.map((entry) => (
                  <div className="nutrition-item" key={entry.id}>
                    <span className="quick-action-icon">
                      <Utensils aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <strong>{entry.foodSnapshot.foodName}</strong>
                      <small>
                        {formatLoggedAmount(entry)} -{' '}
                        {roundMacro(entry.computedCalories)} kcal - P{' '}
                        {roundMacro(entry.computedProteinGrams)} C{' '}
                        {roundMacro(entry.computedCarbohydrateGrams)} F{' '}
                        {roundMacro(entry.computedFatGrams)}
                      </small>
                    </div>
                    <div className="row-actions">
                      <IconButton
                        aria-label={`Edit ${entry.foodSnapshot.foodName} log`}
                        onClick={() => onEdit(entry)}
                        onPointerDown={() => onEdit(entry)}
                      >
                        <Edit2 aria-hidden="true" size={18} />
                      </IconButton>
                      <IconButton
                        aria-label={`Delete ${entry.foodSnapshot.foodName} log`}
                        onClick={() => onDelete(entry)}
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No foods logged"
          message="Search or create a food, then log a serving multiplier for this date."
        />
      )}
    </Card>
  )
}
