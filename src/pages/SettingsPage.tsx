import { useState } from 'react'

import {
  Card,
  FormField,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '@components/ui'

export function SettingsPage() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  return (
    <PageContainer>
      <SectionHeader title="Nutrition targets" />
      <Card>
        <FormField
          id="target-calories"
          label="Calories"
          helpText="Saved later."
        >
          <NumericInput id="target-calories" placeholder="0" />
        </FormField>
        <FormField id="target-protein" label="Protein target">
          <NumericInput id="target-protein" placeholder="0 g" />
        </FormField>
        <PrimaryButton disabled type="button">
          Save targets
        </PrimaryButton>
      </Card>

      <SectionHeader title="Local data" />
      <Card>
        <div className="button-row">
          <SecondaryButton type="button">Export backup</SecondaryButton>
          <SecondaryButton type="button">Restore</SecondaryButton>
        </div>
        <SecondaryButton type="button" onClick={() => setIsConfirmOpen(true)}>
          Clear all data
        </SecondaryButton>
      </Card>

      <ModalConfirmationDialog
        confirmLabel="Keep data"
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => setIsConfirmOpen(false)}
        title="Clear all data?"
      >
        <p>
          Destructive settings actions will require confirmation before they are
          implemented.
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}
