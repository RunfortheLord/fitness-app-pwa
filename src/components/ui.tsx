import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import { useEffect, useId } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'

type AppHeaderProps = {
  title: string
  eyebrow?: string
  action?: ReactNode
}

export function AppHeader({ title, eyebrow, action }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {action ? <div className="app-header-action">{action}</div> : null}
    </header>
  )
}

type PageContainerProps = {
  children: ReactNode
  labelledBy?: string
}

export function PageContainer({ children, labelledBy }: PageContainerProps) {
  return (
    <div className="page-container" aria-labelledby={labelledBy}>
      {children}
    </div>
  )
}

type CardProps = {
  children: ReactNode
  className?: string
  title?: string
}

export function Card({ children, className = '', title }: CardProps) {
  const titleId = title
    ? `${title.toLowerCase().replaceAll(' ', '-')}-title`
    : undefined

  return (
    <section className={`card ${className}`.trim()} aria-labelledby={titleId}>
      {title ? <h2 id={titleId}>{title}</h2> : null}
      {children}
    </section>
  )
}

type MetricCardProps = {
  label: string
  value: string
  detail?: string
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {detail ? <p className="muted">{detail}</p> : null}
    </Card>
  )
}

type SectionHeaderProps = {
  title: string
  action?: ReactNode
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

type BottomSheetProps = {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
}

export function BottomSheet({
  children,
  isOpen,
  onClose,
  title,
}: BottomSheetProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        aria-labelledby={titleId}
        className="bottom-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton aria-label="Close quick actions" onClick={onClose}>
            <X aria-hidden="true" size={20} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  )
}

type ModalConfirmationDialogProps = {
  cancelLabel?: string
  children: ReactNode
  confirmLabel?: string
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
}

export function ModalConfirmationDialog({
  cancelLabel = 'Cancel',
  children,
  confirmLabel = 'Confirm',
  isOpen,
  onCancel,
  onConfirm,
  title,
}: ModalConfirmationDialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', cancelOnEscape)
    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [isOpen, onCancel])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        aria-labelledby={titleId}
        className="confirmation-dialog"
        role="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <SecondaryButton type="button" onClick={onCancel}>
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
        </div>
      </section>
    </div>
  )
}

type SegmentedControlProps = {
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}

export function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps) {
  return (
    <div className="segmented-control" aria-label={label} role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type DateSelectorProps = {
  dateLabel: string
  onNext: () => void
  onPrevious: () => void
  onToday: () => void
}

export function DateSelector({
  dateLabel,
  onNext,
  onPrevious,
  onToday,
}: DateSelectorProps) {
  return (
    <section className="date-selector" aria-label="Selected date">
      <IconButton aria-label="Previous day" onClick={onPrevious}>
        <ChevronLeft aria-hidden="true" size={20} />
      </IconButton>
      <button className="date-selector-current" onClick={onToday} type="button">
        <span>{dateLabel}</span>
        <small>Today</small>
      </button>
      <IconButton aria-label="Next day" onClick={onNext}>
        <ChevronRight aria-hidden="true" size={20} />
      </IconButton>
    </section>
  )
}

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`button button-primary ${className}`.trim()}
      {...props}
    />
  )
}

export function SecondaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`button button-secondary ${className}`.trim()}
      {...props}
    />
  )
}

export function IconButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`icon-button ${className}`.trim()}
      type="button"
      {...props}
    />
  )
}

type FormFieldProps = {
  children: ReactNode
  error?: string
  helpText?: string
  id: string
  label: string
}

export function FormField({
  children,
  error,
  helpText,
  id,
  label,
}: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {helpText ? <p className="field-help">{helpText}</p> : null}
      {error ? <ValidationMessage message={error} /> : null}
    </div>
  )
}

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'type'
>

export function NumericInput(props: NumericInputProps) {
  return <input inputMode="decimal" type="text" {...props} />
}

type EmptyStateProps = {
  action?: ReactNode
  message: string
  title: string
}

export function EmptyState({ action, message, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Check size={22} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function ValidationMessage({ message }: { message: string }) {
  return (
    <p className="validation-message" role="alert">
      {message}
    </p>
  )
}

export function OfflineIndicator({ isOffline }: { isOffline: boolean }) {
  if (!isOffline) {
    return null
  }

  return (
    <aside className="offline-indicator" role="status">
      Offline. Changes stay on this device.
    </aside>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function StatusMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  return (
    <aside className={`status-message status-message-${tone}`} role="status">
      {children}
    </aside>
  )
}
