import { Search } from 'lucide-react'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  ValidationMessage,
} from '@components/ui'

export function NutritionPage() {
  return (
    <PageContainer>
      <SegmentedControl
        label="Nutrition mode"
        onChange={() => undefined}
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Foods', value: 'foods' },
          { label: 'Targets', value: 'targets' },
        ]}
        value="day"
      />

      <Card title="Daily total">
        <p className="metric-value">0 kcal</p>
        <p className="muted">Targets and food logs are not connected yet.</p>
      </Card>

      <SectionHeader
        title="Food search"
        action={
          <IconButton aria-label="Search foods">
            <Search aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card>
        <FormField
          id="food-name"
          label="Food name"
          helpText="Manual foods arrive later."
        >
          <input
            id="food-name"
            placeholder="Search or create food"
            type="search"
          />
        </FormField>
        <FormField
          error="Calories must be zero or greater."
          id="food-calories"
          label="Calories"
        >
          <NumericInput
            id="food-calories"
            aria-invalid="true"
            placeholder="0"
          />
        </FormField>
        <ValidationMessage message="This placeholder form is not saved yet." />
        <PrimaryButton disabled type="button">
          Save food
        </PrimaryButton>
      </Card>

      <EmptyState
        title="No recent foods"
        message="Reusable foods and logged rows will appear here."
      />
    </PageContainer>
  )
}
