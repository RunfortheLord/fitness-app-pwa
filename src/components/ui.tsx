import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  HTMLAttributes,
  MouseEvent,
  RefObject,
  ReactNode,
} from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'

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

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  className?: string
  title?: string
}

export function Card({ children, className = '', title, ...props }: CardProps) {
  const titleId = title
    ? `${title.toLowerCase().replaceAll(' ', '-')}-title`
    : undefined

  return (
    <section
      className={`card ${className}`.trim()}
      aria-labelledby={titleId}
      {...props}
    >
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
  /**
   * 'sheet' (default) renders the standard bottom sheet with a close button.
   * 'page' renders a full-height sub-page with a leading back arrow, for flows
   * the user navigates into and backs out of (e.g. editing a program).
   */
  variant?: 'sheet' | 'page'
}

export function BottomSheet({
  children,
  isOpen,
  onClose,
  title,
  variant = 'sheet',
}: BottomSheetProps) {
  const titleId = useId()
  const sheetRef = useRef<HTMLElement>(null)

  useDialogFocusManagement({
    containerRef: sheetRef,
    isOpen,
    onClose,
  })

  if (!isOpen) {
    return null
  }

  const isPage = variant === 'page'

  return (
    <div
      className={`sheet-backdrop${isPage ? ' sheet-backdrop--page' : ''}`}
      role="presentation"
      onMouseDown={isPage ? undefined : onClose}
    >
      <section
        aria-modal="true"
        aria-labelledby={titleId}
        className={isPage ? 'bottom-sheet bottom-sheet--page' : 'bottom-sheet'}
        ref={sheetRef}
        role="dialog"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {isPage ? (
          <div className="sheet-header sheet-header--page">
            <IconButton
              aria-label={`Back from ${title.toLowerCase()}`}
              onClick={onClose}
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </IconButton>
            <h2 id={titleId}>{title}</h2>
          </div>
        ) : (
          <>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h2 id={titleId}>{title}</h2>
              <IconButton
                aria-label={`Close ${title.toLowerCase()}`}
                onClick={onClose}
              >
                <X aria-hidden="true" size={20} />
              </IconButton>
            </div>
          </>
        )}
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
  const dialogRef = useRef<HTMLElement>(null)

  useDialogFocusManagement({
    containerRef: dialogRef,
    isOpen,
    onClose: onCancel,
  })

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        aria-labelledby={titleId}
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
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
      <button
        aria-label="Return to today"
        className="date-selector-current"
        onClick={onToday}
        type="button"
      >
        <span>{dateLabel}</span>
        <small>Today</small>
      </button>
      <IconButton aria-label="Next day" onClick={onNext}>
        <ChevronRight aria-hidden="true" size={20} />
      </IconButton>
    </section>
  )
}

type AsyncButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> & {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>
}

/**
 * Disables the button while an async `onClick` is in flight so a double-tap
 * cannot submit twice. Synchronous handlers are unaffected.
 */
function useAsyncClick(onClick: AsyncButtonProps['onClick']): {
  pending: boolean
  handleClick?: (event: MouseEvent<HTMLButtonElement>) => void
} {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  if (!onClick) {
    return { pending: false }
  }

  return {
    pending,
    handleClick: (event) => {
      if (pendingRef.current) {
        return
      }
      const result = onClick(event)
      if (
        result &&
        typeof (result as PromiseLike<unknown>).then === 'function'
      ) {
        pendingRef.current = true
        setPending(true)
        void Promise.resolve(result).finally(() => {
          pendingRef.current = false
          setPending(false)
        })
      }
    },
  }
}

export function PrimaryButton({
  className = '',
  disabled,
  onClick,
  ...props
}: AsyncButtonProps) {
  const { pending, handleClick } = useAsyncClick(onClick)
  return (
    <button
      className={`button button-primary ${className}`.trim()}
      disabled={disabled || pending}
      onClick={handleClick}
      {...props}
    />
  )
}

export function SecondaryButton({
  className = '',
  disabled,
  onClick,
  ...props
}: AsyncButtonProps) {
  const { pending, handleClick } = useAsyncClick(onClick)
  return (
    <button
      className={`button button-secondary ${className}`.trim()}
      disabled={disabled || pending}
      onClick={handleClick}
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
  const helpId = helpText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {helpText ? (
        <p className="field-help" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {error ? <ValidationMessage id={errorId} message={error} /> : null}
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

export function ValidationMessage({
  id,
  message,
}: {
  id?: string
  message: string
}) {
  return (
    <p className="validation-message" id={id} role="alert">
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

/**
 * A transient confirmation that announces itself politely and auto-dismisses,
 * so success messages do not pile up or shift page layout.
 */
export function Toast({
  message,
  onDismiss,
  tone = 'success',
  durationMs = 3500,
}: {
  message: string | null
  onDismiss: () => void
  tone?: 'neutral' | 'success' | 'warning'
  durationMs?: number
}) {
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!message) {
      return
    }
    const timeoutId = window.setTimeout(
      () => onDismissRef.current(),
      durationMs,
    )
    return () => window.clearTimeout(timeoutId)
  }, [message, durationMs])

  if (!message) {
    return null
  }

  return (
    <div className="toast-region" aria-live="polite">
      <div className={`toast toast-${tone}`} role="status">
        <span>{message}</span>
        <IconButton aria-label="Dismiss notification" onClick={onDismiss}>
          <X aria-hidden="true" size={16} />
        </IconButton>
      </div>
    </div>
  )
}

function useDialogFocusManagement({
  containerRef,
  isOpen,
  onClose,
}: {
  containerRef: RefObject<HTMLElement | null>
  isOpen: boolean
  onClose: () => void
}) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    window.setTimeout(() => {
      const container = containerRef.current
      const firstFocusable = getFocusableElements(container)[0]
      ;(firstFocusable ?? container)?.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusable = getFocusableElements(containerRef.current)
      if (!focusable.length) {
        event.preventDefault()
        containerRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [containerRef, isOpen])
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.offsetParent !== null,
  )
}
