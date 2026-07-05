import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  HTMLAttributes,
  MouseEvent,
  RefObject,
  ReactNode,
} from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X,
} from 'lucide-react'

import { useLanguage } from '@components/languageContextValue'

type AppHeaderProps = {
  title: string
  eyebrow?: string
  action?: ReactNode
}

export function AppHeader({ title, eyebrow, action }: AppHeaderProps) {
  const { t } = useLanguage()
  return (
    <header className="app-header">
      <div className="app-header-copy">
        {eyebrow ? <p className="eyebrow">{t(eyebrow)}</p> : null}
        <h1>{t(title)}</h1>
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
  const { t } = useLanguage()
  const titleId = title
    ? `${title.toLowerCase().replaceAll(' ', '-')}-title`
    : undefined

  return (
    <section
      className={`card ${className}`.trim()}
      aria-labelledby={titleId}
      {...props}
    >
      {title ? <h2 id={titleId}>{t(title)}</h2> : null}
      {children}
    </section>
  )
}

type MetricCardProps = {
  label: string
  onClick?: () => void
  value: string
  detail?: string
}

export function MetricCard({ label, onClick, value, detail }: MetricCardProps) {
  const { t } = useLanguage()
  const content = (
    <>
      <p className="metric-label">{t(label)}</p>
      <p className="metric-value">{value}</p>
      {detail ? <p className="muted">{t(detail)}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        aria-label={t(`Open ${label.toLowerCase()}`)}
        className="card metric-card metric-card-button"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    )
  }

  return <Card className="metric-card">{content}</Card>
}

type SectionHeaderProps = {
  title: string
  action?: ReactNode
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const { t } = useLanguage()
  return (
    <div className="section-header">
      <h2>{t(title)}</h2>
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

const SHEET_EXIT_ANIMATION_MS = 180

function getSheetExitAnimationMs() {
  if (import.meta.env.MODE === 'test') {
    return 0
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 0
  }

  return SHEET_EXIT_ANIMATION_MS
}

export function BottomSheet({
  children,
  isOpen,
  onClose,
  title,
  variant = 'sheet',
}: BottomSheetProps) {
  const { language, t } = useLanguage()
  const titleId = useId()
  const sheetRef = useRef<HTMLElement>(null)
  const [isPresent, setIsPresent] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect --
   * This component mirrors `isOpen` into transient presence state so close
   * animations can finish before the dialog unmounts.
   */
  useEffect(() => {
    if (isOpen) {
      setIsPresent(true)
      setIsClosing(false)
      return
    }

    if (!isPresent) {
      return
    }

    setIsClosing(true)
    const exitAnimationMs = getSheetExitAnimationMs()
    if (exitAnimationMs === 0) {
      setIsPresent(false)
      setIsClosing(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsPresent(false)
      setIsClosing(false)
    }, exitAnimationMs)

    return () => window.clearTimeout(timeoutId)
  }, [isOpen, isPresent])
  /* eslint-enable react-hooks/set-state-in-effect */

  useDialogFocusManagement({
    containerRef: sheetRef,
    isOpen: isOpen && isPresent && !isClosing,
    onClose,
  })

  if (!isPresent) {
    return null
  }

  const isPage = variant === 'page'
  const backdropClassName = [
    'sheet-backdrop',
    isPage ? 'sheet-backdrop--page' : '',
    isClosing ? 'is-closing' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const sheetClassName = [
    'bottom-sheet',
    isPage ? 'bottom-sheet--page' : '',
    isClosing ? 'is-closing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={backdropClassName}
      role="presentation"
      onMouseDown={isPage || isClosing ? undefined : onClose}
    >
      <section
        aria-hidden={isClosing ? true : undefined}
        aria-modal="true"
        aria-labelledby={titleId}
        className={sheetClassName}
        ref={sheetRef}
        role="dialog"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {isPage ? (
          <div className="sheet-header sheet-header--page">
            <IconButton
              aria-label={
                language === 'en'
                  ? `Back from ${title.toLowerCase()}`
                  : `${t('Back')}: ${t(title)}`
              }
              onClick={onClose}
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </IconButton>
            <h2 id={titleId}>{t(title)}</h2>
          </div>
        ) : (
          <>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h2 id={titleId}>{t(title)}</h2>
              <IconButton
                aria-label={
                  language === 'en'
                    ? `Close ${title.toLowerCase()}`
                    : `${t('Close')}: ${t(title)}`
                }
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
  const { t } = useLanguage()
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
        <h2 id={titleId}>{t(title)}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <SecondaryButton type="button" onClick={onCancel}>
            {t(cancelLabel)}
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onConfirm}>
            {t(confirmLabel)}
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
  const { t } = useLanguage()
  const segmentStyle = {
    '--segment-count': options.length,
  } as CSSProperties

  return (
    <div
      className="segmented-control"
      aria-label={t(label)}
      role="group"
      style={segmentStyle}
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {t(option.label)}
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
  const { t } = useLanguage()
  return (
    <section className="date-selector" aria-label={t('Selected date')}>
      <IconButton aria-label={t('Previous day')} onClick={onPrevious}>
        <ChevronLeft aria-hidden="true" size={20} />
      </IconButton>
      <button
        aria-label={t('Return to today')}
        className="date-selector-current"
        onClick={onToday}
        type="button"
      >
        <span>{dateLabel}</span>
        <small>{t('Today')}</small>
      </button>
      <IconButton aria-label={t('Next day')} onClick={onNext}>
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
  const { t } = useLanguage()
  const { pending, handleClick } = useAsyncClick(onClick)
  const children =
    typeof props.children === 'string' ? t(props.children) : props.children
  return (
    <button
      className={`button button-primary ${className}`.trim()}
      disabled={disabled || pending}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  className = '',
  disabled,
  onClick,
  ...props
}: AsyncButtonProps) {
  const { t } = useLanguage()
  const { pending, handleClick } = useAsyncClick(onClick)
  const children =
    typeof props.children === 'string' ? t(props.children) : props.children
  return (
    <button
      className={`button button-secondary ${className}`.trim()}
      disabled={disabled || pending}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { t } = useLanguage()
  const ariaLabel =
    typeof props['aria-label'] === 'string'
      ? t(props['aria-label'])
      : props['aria-label']
  return (
    <button
      className={`icon-button ${className}`.trim()}
      type="button"
      {...props}
      aria-label={ariaLabel}
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
  const { t } = useLanguage()
  const helpId = helpText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="form-field">
      <label htmlFor={id}>{t(label)}</label>
      {children}
      {helpText ? (
        <p className="field-help" id={helpId}>
          {t(helpText)}
        </p>
      ) : null}
      {error ? <ValidationMessage id={errorId} message={t(error)} /> : null}
    </div>
  )
}

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'type'
>

export function NumericInput(props: NumericInputProps) {
  const { t } = useLanguage()
  const placeholder =
    typeof props.placeholder === 'string'
      ? t(props.placeholder)
      : props.placeholder
  return (
    <input
      inputMode="decimal"
      type="text"
      {...props}
      placeholder={placeholder}
    />
  )
}

/**
 * Numeric input flanked by 44px minus/plus buttons so common adjustments
 * never need the keyboard. Values stay strings (form state convention);
 * stepping from an empty field starts at the minimum.
 */
export function StepperInput({
  decrementLabel,
  id,
  incrementLabel,
  max,
  min = 0,
  onValueChange,
  step = 1,
  value,
}: {
  decrementLabel: string
  id: string
  incrementLabel: string
  max?: number
  min?: number
  onValueChange: (value: string) => void
  step?: number
  value: string
}) {
  function adjust(direction: -1 | 1) {
    const current = Number(value)
    const hasValue = value.trim() !== '' && Number.isFinite(current)
    let next = hasValue ? current + direction * step : min
    next = Math.max(min, next)
    if (max !== undefined) {
      next = Math.min(max, next)
    }
    // Round away float noise from fractional steps like 2.5.
    onValueChange(String(Math.round(next * 100) / 100))
  }
  return (
    <div className="stepper-input">
      <IconButton
        aria-label={decrementLabel}
        className="stepper-button"
        onClick={() => adjust(-1)}
      >
        <Minus aria-hidden="true" size={18} />
      </IconButton>
      <NumericInput
        id={id}
        onChange={(event) => onValueChange(event.target.value)}
        value={value}
      />
      <IconButton
        aria-label={incrementLabel}
        className="stepper-button"
        onClick={() => adjust(1)}
      >
        <Plus aria-hidden="true" size={18} />
      </IconButton>
    </div>
  )
}

type EmptyStateProps = {
  action?: ReactNode
  message: string
  title: string
}

export function EmptyState({ action, message, title }: EmptyStateProps) {
  const { t } = useLanguage()
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Check size={22} />
      </div>
      <h3>{t(title)}</h3>
      <p>{t(message)}</p>
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
  const { t } = useLanguage()
  return (
    <p className="validation-message" id={id} role="alert">
      {t(message)}
    </p>
  )
}

export function OfflineIndicator({ isOffline }: { isOffline: boolean }) {
  const { t } = useLanguage()
  if (!isOffline) {
    return null
  }

  return (
    <aside className="offline-indicator" role="status">
      {t('Offline. Changes stay on this device.')}
    </aside>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { t } = useLanguage()
  return (
    <div className="loading-state" role="status">
      <span aria-hidden="true" />
      <p>{t(label)}</p>
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
  const { t } = useLanguage()
  const content = typeof children === 'string' ? t(children) : children
  return (
    <aside className={`status-message status-message-${tone}`} role="status">
      {content}
    </aside>
  )
}

/**
 * A transient confirmation that announces itself politely and auto-dismisses,
 * so success messages do not pile up or shift page layout.
 */
export function Toast({
  actionLabel,
  message,
  onAction,
  onDismiss,
  tone = 'success',
  durationMs = 3500,
}: {
  actionLabel?: string
  message: string | null
  onAction?: () => void
  onDismiss: () => void
  tone?: 'neutral' | 'success' | 'warning'
  durationMs?: number
}) {
  const { t } = useLanguage()
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
        <span>{t(message)}</span>
        {actionLabel && onAction ? (
          <button className="toast-action" onClick={onAction} type="button">
            {t(actionLabel)}
          </button>
        ) : null}
        <IconButton aria-label={t('Dismiss notification')} onClick={onDismiss}>
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
