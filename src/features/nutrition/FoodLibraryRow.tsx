import { Edit2, Plus, RotateCcw, Star, Utensils } from 'lucide-react'

import { IconButton } from '@components/ui'
import { FoodIcon } from '@components/FoodIcon'
import type { FoodSearchResult } from '@domain/foodSearchSections'
import type { FoodUnitPreference } from '@shared-types/app'

import { resultDisplay } from './foodDisplay'
import { roundMacro } from './nutritionForms'

export function FoodLibraryRow({
  result,
  rememberedServing,
  onEdit,
  onSelect,
  onAdd,
  isFavorite,
  onToggleFavorite,
  onQuickLog,
}: {
  result: FoodSearchResult
  rememberedServing?: FoodUnitPreference | null
  onEdit: (() => void) | null
  onSelect: () => void
  // When provided, the trailing "+" logs the food at its displayed serving
  // instead of opening the serving sheet (which the row banner still does).
  onAdd?: (() => void) | null
  isFavorite?: boolean
  onToggleFavorite?: (() => void) | null
  onQuickLog?: (() => void) | null
}) {
  const display = resultDisplay(result, rememberedServing)
  const iconCategory =
    result.type === 'external' ? result.food.foodCategory : null
  const iconName =
    result.type === 'savedMeal' ? result.meal.name : result.food.name

  return (
    <div className="nutrition-item">
      <span className="quick-action-icon">
        {result.type === 'savedMeal' ? (
          <Utensils aria-hidden="true" size={18} />
        ) : (
          <FoodIcon name={iconName} category={iconCategory} size={18} />
        )}
      </span>
      <button
        aria-label={`Select ${display.name}`}
        className="nutrition-result-button"
        type="button"
        onClick={onSelect}
      >
        <span className="food-result-main">
          <strong>{display.name}</strong>
          {display.brand ? (
            <span className="brand-badge">{display.brand}</span>
          ) : null}
          <small>{display.serving}</small>
        </span>
        <span className="food-result-calories">
          {roundMacro(display.calories)} kcal
        </span>
      </button>
      <div className="row-actions">
        {onToggleFavorite ? (
          <IconButton
            aria-label={
              isFavorite
                ? `Unfavorite ${display.name}`
                : `Favorite ${display.name}`
            }
            aria-pressed={isFavorite}
            className={isFavorite ? 'is-favorite' : ''}
            onClick={onToggleFavorite}
          >
            <Star
              aria-hidden="true"
              size={18}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </IconButton>
        ) : null}
        {onEdit ? (
          <IconButton aria-label={`Edit ${display.name}`} onClick={onEdit}>
            <Edit2 aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        {onQuickLog ? (
          <IconButton
            aria-label={`Log ${display.name} again`}
            onClick={onQuickLog}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={onAdd ? `Add ${display.name}` : `Open ${display.name}`}
          onClick={onAdd ?? onSelect}
        >
          <Plus aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}
