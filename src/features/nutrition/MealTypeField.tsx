import { SegmentedControl } from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { MEAL_LABELS, MEAL_TYPES } from '@domain/meals'
import type { MealType } from '@shared-types/app'

export function MealTypeField({
  value,
  onChange,
}: {
  value: MealType
  onChange: (value: MealType) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="form-field meal-field">
      <span className="meal-field-label">{t('Meal')}</span>
      <SegmentedControl
        label="Meal"
        options={MEAL_TYPES.map((meal) => ({
          value: meal,
          label: MEAL_LABELS[meal],
        }))}
        value={value}
        onChange={(next) => onChange(next as MealType)}
      />
    </div>
  )
}
