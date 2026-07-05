import { useState } from 'react'

import {
  BottomSheet,
  FormField,
  PrimaryButton,
  ValidationMessage,
} from '@components/ui'
import { programRepository } from '@repositories/programRepository'

import { emptyProgramForm, parseDurationWeeks } from './programForms'

export function ProgramCreateSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (templateId: string) => void
}) {
  const [form, setForm] = useState(emptyProgramForm)
  const [error, setError] = useState<string | null>(null)
  const name = form.name.trim()

  function saveProgram() {
    if (!name) {
      setError('Program name is required.')
      return
    }

    return programRepository
      .createProgramTemplate({
        name,
        durationWeeks: parseDurationWeeks(form.durationWeeks),
        days: [],
      })
      .then((created) => onCreated(created.template.id))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Program could not save.',
        )
      })
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Create program">
      <FormField id="program-name" label="Program name">
        <input
          id="program-name"
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          value={form.name}
        />
      </FormField>
      <FormField id="program-weeks" label="Program length (weeks)">
        <input
          id="program-weeks"
          inputMode="numeric"
          type="number"
          min={1}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              durationWeeks: event.target.value,
            }))
          }
          value={form.durationWeeks}
        />
      </FormField>
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!name} type="button" onClick={saveProgram}>
        Save program
      </PrimaryButton>
    </BottomSheet>
  )
}
