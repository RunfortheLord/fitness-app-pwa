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
import { useLanguage } from '@components/languageContextValue'
import { formatLocalDate, type LocalDateString } from '@domain/dates'
import {
  weightInputToLb,
  weightInputValue,
  weightUnitSuffix,
} from '@domain/weightUnits'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useWeightUnit } from '@hooks/useWeightUnit'
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
  const { t } = useLanguage()
  const inputId = useId()
  const dateInputId = useId()
  const [error, setError] = useState('')
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const { refreshDashboard } = useDashboardContext()
  const weightUnit = useWeightUnit()
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
    const selectedDate = String(formData.get('localDate') ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      setError('Choose a valid date.')
      return
    }
    const parsed = Number(weight)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a positive bodyweight.')
      return
    }
    // Weights persist in canonical pounds; convert from the displayed unit
    // before validating against the realistic-weight ceiling and saving.
    const weightLb = weightInputToLb(parsed, weightUnit)
    if (weightLb > 1500) {
      setError('Enter a realistic bodyweight.')
      return
    }

    setError('')
    try {
      if (existingEntry) {
        await bodyweightRepository.updateBodyweight({
          id: existingEntry.id,
          localDate: selectedDate as LocalDateString,
          weight: weightLb,
        })
      } else {
        await bodyweightRepository.saveBodyweight({
          localDate: selectedDate as LocalDateString,
          weight: weightLb,
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
          <FormField id={dateInputId} label="Date">
            <input
              className="bodyweight-date-input"
              defaultValue={existingEntry?.localDate ?? localDate}
              id={dateInputId}
              key={`${existingEntry?.id ?? `${localDate}-new`}-date`}
              max={formatLocalDate(new Date())}
              name="localDate"
              onChange={() => setError('')}
              type="date"
            />
          </FormField>
          <FormField
            error={error}
            helpText={
              weightUnit === 'kg'
                ? 'Entered in kilograms.'
                : 'Entered in pounds.'
            }
            id={inputId}
            label="Bodyweight"
          >
            <div className="input-with-unit">
              <NumericInput
                aria-describedby={
                  error ? `${inputId}-error` : `${inputId}-help`
                }
                autoComplete="off"
                defaultValue={
                  existingEntry
                    ? weightInputValue(
                        existingEntry.weight,
                        weightUnit,
                        'bodyweight',
                      )
                    : ''
                }
                id={inputId}
                key={`${existingEntry?.id ?? `${localDate}-new`}-${weightUnit}`}
                name="weight"
                onChange={() => setError('')}
                placeholder={weightUnit === 'kg' ? '84' : '185'}
              />
              <span>{weightUnitSuffix(weightUnit)}</span>
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
                {t('Delete')}
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
        {t('This removes the selected bodyweight entry for {date}.', {
          date: localDate,
        })}
      </ModalConfirmationDialog>
    </>
  )
}
