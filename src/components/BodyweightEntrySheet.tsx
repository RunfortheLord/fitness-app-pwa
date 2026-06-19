import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'

import {
  BottomSheet,
  FormField,
  ModalConfirmationDialog,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
} from '@components/ui'
import { type LocalDateString } from '@domain/dates'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { bodyweightRepository } from '@repositories/bodyweightRepository'

type BodyweightEntrySheetProps = {
  entryId?: string
  isOpen: boolean
  localDate: LocalDateString | null
  onClose: () => void
}

export function BodyweightEntrySheet({
  entryId,
  isOpen,
  localDate,
  onClose,
}: BodyweightEntrySheetProps) {
  const inputId = useId()
  const [error, setError] = useState('')
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const { refreshDashboard } = useDashboardContext()
  const existingEntry = useLiveQuery(async () => {
    if (!localDate) {
      return undefined
    }

    return entryId
      ? bodyweightRepository.getBodyweightEntry(entryId)
      : undefined
  }, [entryId, localDate])

  if (!localDate) {
    return null
  }

  async function saveBodyweight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!localDate) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const weight = String(formData.get('weight') ?? '')
    const parsed = Number(weight)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a positive bodyweight.')
      return
    }
    if (parsed > 1500) {
      setError('Enter a realistic bodyweight.')
      return
    }

    setError('')
    try {
      if (existingEntry) {
        await bodyweightRepository.updateBodyweight({
          id: existingEntry.id,
          weight: parsed,
        })
      } else {
        await bodyweightRepository.saveBodyweight({
          localDate,
          weight: parsed,
        })
      }
      refreshDashboard()
      onClose()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Bodyweight could not be saved.',
      )
    }
  }

  async function deleteBodyweight() {
    if (!localDate) {
      return
    }

    if (!existingEntry) {
      return
    }

    try {
      await bodyweightRepository.deleteBodyweightEntry(existingEntry.id)
      refreshDashboard()
      setIsConfirmingDelete(false)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Bodyweight could not be deleted.',
      )
      setIsConfirmingDelete(false)
    }
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Log bodyweight">
        <form onSubmit={saveBodyweight}>
          <p className="muted sheet-context">{localDate}</p>
          <FormField
            error={error}
            helpText="Pounds are the default unit."
            id={inputId}
            label="Bodyweight"
          >
            <div className="input-with-unit">
              <NumericInput
                aria-describedby={
                  error ? `${inputId}-error` : `${inputId}-help`
                }
                autoComplete="off"
                defaultValue={existingEntry ? String(existingEntry.weight) : ''}
                id={inputId}
                key={existingEntry?.id ?? `${localDate}-new`}
                name="weight"
                onChange={() => setError('')}
                placeholder="185"
              />
              <span>lb</span>
            </div>
          </FormField>
          <div className="dialog-actions">
            {existingEntry ? (
              <SecondaryButton
                className="button-danger"
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2 aria-hidden="true" size={18} />
                Delete
              </SecondaryButton>
            ) : null}
            <SecondaryButton type="button" onClick={onClose}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit">Save</PrimaryButton>
          </div>
        </form>
      </BottomSheet>

      <ModalConfirmationDialog
        confirmLabel="Delete"
        isOpen={isConfirmingDelete}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => void deleteBodyweight()}
        title="Delete bodyweight?"
      >
        This removes the selected bodyweight entry for {localDate}.
      </ModalConfirmationDialog>
    </>
  )
}
