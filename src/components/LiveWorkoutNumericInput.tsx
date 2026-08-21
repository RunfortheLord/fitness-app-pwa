import { Delete } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { useLanguage } from '@components/languageContextValue'
import { NumericInput } from '@components/ui'
import {
  applyNumericKeypadCommand,
  keyboardEventToNumericKeypadCommand,
  shouldUseLiveWorkoutAppKeypad,
  type LiveWorkoutNumericKeypadMode,
  type NumericKeypadCommand,
} from '@domain/liveWorkoutKeypad'

type ActiveEditor = {
  id: number
  inputId: string
  label: string
  mode: LiveWorkoutNumericKeypadMode
  onCommit?: () => void
  onValueChange: (value: string) => void
  replaceOnNextEntry: boolean
  trigger: HTMLInputElement
  value: string
}

type KeypadContextValue = {
  activeInputId: string | null
  closeForTrigger: (trigger: HTMLInputElement) => void
  open: (editor: Omit<ActiveEditor, 'id' | 'replaceOnNextEntry'>) => void
}

const LiveWorkoutKeypadContext = createContext<KeypadContextValue | null>(null)
const LIVE_WORKOUT_KEYPAD_ID = 'live-workout-numeric-keypad'
const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function LiveWorkoutNumericKeypadProvider({
  children,
}: {
  children: ReactNode
}) {
  const { t } = useLanguage()
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null)
  const activeEditorRef = useRef<ActiveEditor | null>(null)
  const nextEditorIdRef = useRef(0)
  const firstKeyRef = useRef<HTMLButtonElement>(null)
  const activeEditorId = activeEditor?.id

  const closeEditor = useCallback((restoreFocus = true) => {
    const editor = activeEditorRef.current
    if (!editor) {
      return
    }

    activeEditorRef.current = null
    setActiveEditor(null)
    editor.onCommit?.()

    if (restoreFocus && editor.trigger.isConnected) {
      window.requestAnimationFrame(() => {
        editor.trigger.focus({ preventScroll: true })
      })
    }
  }, [])

  const closeForTrigger = useCallback(
    (trigger: HTMLInputElement) => {
      if (activeEditorRef.current?.trigger === trigger) {
        closeEditor(false)
      }
    },
    [closeEditor],
  )

  const open = useCallback(
    (editor: Omit<ActiveEditor, 'id' | 'replaceOnNextEntry'>) => {
      const current = activeEditorRef.current
      if (current?.trigger === editor.trigger) {
        return
      }
      if (current) {
        closeEditor(false)
      }

      const next: ActiveEditor = {
        ...editor,
        id: ++nextEditorIdRef.current,
        replaceOnNextEntry: editor.value !== '',
      }
      activeEditorRef.current = next
      setActiveEditor(next)
    },
    [closeEditor],
  )

  const edit = useCallback((command: NumericKeypadCommand) => {
    const current = activeEditorRef.current
    if (!current) {
      return
    }

    const result = applyNumericKeypadCommand(
      current.value,
      current.mode,
      command,
      current.replaceOnNextEntry,
    )
    if (
      result.value === current.value &&
      result.replaceOnNextEntry === current.replaceOnNextEntry
    ) {
      return
    }

    const next = {
      ...current,
      replaceOnNextEntry: result.replaceOnNextEntry,
      value: result.value,
    }
    activeEditorRef.current = next
    setActiveEditor(next)
    current.onValueChange(result.value)
  }, [])

  useEffect(() => {
    if (activeEditorId === undefined) {
      return
    }

    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) {
      root.inert = true
    }
    document.body.classList.add('live-workout-keypad-open')
    firstKeyRef.current?.focus({ preventScroll: true })

    return () => {
      if (root) {
        root.inert = wasInert
      }
      document.body.classList.remove('live-workout-keypad-open')
    }
  }, [activeEditorId])

  useEffect(() => () => closeEditor(false), [closeEditor])

  function handleKeypadKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const editor = activeEditorRef.current
    if (!editor) {
      return
    }
    const command = keyboardEventToNumericKeypadCommand(
      event.nativeEvent,
      editor.mode,
    )
    if (command) {
      event.preventDefault()
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()
      edit(command)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()
      closeEditor()
    }
  }

  const contextValue = useMemo<KeypadContextValue>(
    () => ({
      activeInputId: activeEditor?.inputId ?? null,
      closeForTrigger,
      open,
    }),
    [activeEditor?.inputId, closeForTrigger, open],
  )

  return (
    <LiveWorkoutKeypadContext.Provider value={contextValue}>
      {children}
      {activeEditor
        ? createPortal(
            <div
              className="live-workout-keypad-backdrop"
              role="presentation"
              onMouseDown={() => closeEditor()}
            >
              <section
                aria-label={t(`${activeEditor.label} number pad`)}
                aria-modal="true"
                className="live-workout-keypad"
                id={LIVE_WORKOUT_KEYPAD_ID}
                role="dialog"
                onKeyDownCapture={handleKeypadKeyDown}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="live-workout-keypad-header">
                  <span>{t(activeEditor.label)}</span>
                  <output aria-live="polite">
                    {activeEditor.value || t('Blank')}
                  </output>
                </div>
                <div
                  aria-label={t('Number pad')}
                  className="live-workout-keypad-grid"
                  role="group"
                >
                  {KEYPAD_DIGITS.map((digit, index) => (
                    <button
                      key={digit}
                      ref={index === 0 ? firstKeyRef : undefined}
                      type="button"
                      onClick={() => edit(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                  {activeEditor.mode === 'decimal' ? (
                    <button type="button" onClick={() => edit('.')}>
                      .
                    </button>
                  ) : activeEditor.mode === 'duration' ? (
                    <button
                      aria-label={t('Colon')}
                      type="button"
                      onClick={() => edit(':')}
                    >
                      :
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <button type="button" onClick={() => edit('0')}>
                    0
                  </button>
                  <button
                    aria-label={t('Backspace')}
                    type="button"
                    onClick={() => edit('backspace')}
                  >
                    <Delete aria-hidden="true" size={24} />
                  </button>
                </div>
                <div className="live-workout-keypad-actions">
                  <button type="button" onClick={() => edit('clear')}>
                    {t('Clear')}
                  </button>
                  <button
                    className="live-workout-keypad-done"
                    type="button"
                    onClick={() => closeEditor()}
                  >
                    {t('Done')}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </LiveWorkoutKeypadContext.Provider>
  )
}

type LiveWorkoutNumericInputProps = Omit<
  ComponentProps<typeof NumericInput>,
  'defaultValue' | 'onBlur' | 'onChange' | 'onFocus' | 'value'
> & {
  mode: LiveWorkoutNumericKeypadMode
  onCommit?: () => void
  onEditStart?: () => void
  onValueChange: (value: string) => void
  value: string
}

export function LiveWorkoutNumericInput({
  disabled,
  mode,
  onCommit,
  onEditStart,
  onKeyDown,
  onValueChange,
  value,
  ...props
}: LiveWorkoutNumericInputProps) {
  const context = useContext(LiveWorkoutKeypadContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [usesAppKeypad] = useState(shouldUseLiveWorkoutAppKeypad)
  const onCommitRef = useRef(onCommit)
  const onValueChangeRef = useRef(onValueChange)
  const isActive = context?.activeInputId === inputId
  const closeForTrigger = context?.closeForTrigger
  const label =
    typeof props['aria-label'] === 'string'
      ? props['aria-label']
      : typeof props.id === 'string'
        ? props.id
        : 'Workout value'

  useEffect(() => {
    onCommitRef.current = onCommit
    onValueChangeRef.current = onValueChange
  }, [onCommit, onValueChange])

  useEffect(() => {
    const input = inputRef.current
    if (!input || !closeForTrigger) {
      return
    }
    if (disabled) {
      closeForTrigger(input)
    }
    return () => closeForTrigger(input)
  }, [closeForTrigger, disabled])

  function openKeypad() {
    const input = inputRef.current
    if (!input || !context || disabled) {
      return
    }
    onEditStart?.()
    context.open({
      inputId,
      label,
      mode,
      onCommit: () => onCommitRef.current?.(),
      onValueChange: (nextValue) => onValueChangeRef.current(nextValue),
      trigger: input,
      value,
    })
  }

  if (!usesAppKeypad) {
    return (
      <NumericInput
        {...props}
        disabled={disabled}
        onBlur={() => onCommitRef.current?.()}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        onFocus={(event) => {
          onEditStart?.()
          if (event.currentTarget.value) {
            event.currentTarget.select()
          }
        }}
        onKeyDown={onKeyDown}
        value={value}
      />
    )
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openKeypad()
      return
    }
    onKeyDown?.(event)
  }

  return (
    <input
      {...props}
      aria-controls={isActive ? LIVE_WORKOUT_KEYPAD_ID : undefined}
      aria-expanded={isActive}
      aria-haspopup="dialog"
      className={`live-workout-keypad-input ${props.className ?? ''}`.trim()}
      disabled={disabled}
      inputMode="none"
      onClick={openKeypad}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerUp={(event) => {
        event.stopPropagation()
        if (event.button === 0) {
          openKeypad()
        }
      }}
      readOnly
      ref={inputRef}
      type="text"
      value={value}
    />
  )
}
