import { useEffect } from 'react'

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/**
 * Whether focusing this element opens the on-screen software keyboard. Excludes
 * the live-workout keypad inputs, which are read-only with `inputmode="none"`.
 */
export function opensSoftwareKeyboard(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const contentEditable = target.getAttribute('contenteditable')
  if (contentEditable === '' || contentEditable === 'true') {
    return true
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled
  }
  if (target instanceof HTMLInputElement) {
    if (target.readOnly || target.disabled) {
      return false
    }
    if (target.inputMode === 'none') {
      return false
    }
    return !NON_TEXT_INPUT_TYPES.has(target.type)
  }
  return false
}

/**
 * Hide the fixed bottom navigation while a software keyboard is open so iOS
 * cannot float it up over the page (the visual viewport shifts fixed elements
 * when the keyboard appears). The nav is restored — freshly positioned — as
 * soon as focus leaves the editable field, which also clears any lingering
 * offset.
 *
 * Pass `active: false` on screens that own their own pinned layout — notably
 * the live workout, whose number fields fall back to a real text input on the
 * web (the in-app keypad is installed-iOS only). Hiding the nav there would
 * strand the user with no way to navigate away mid-set.
 */
export function useSoftwareKeyboardNav(active = true) {
  useEffect(() => {
    const body = document.body
    if (!active) {
      // Ensure the nav is never left hidden when this screen opts out.
      body.classList.remove('keyboard-input-open')
      return
    }

    function setOpen(isOpen: boolean) {
      body.classList.toggle('keyboard-input-open', isOpen)
    }

    function handleFocusIn(event: FocusEvent) {
      if (opensSoftwareKeyboard(event.target)) {
        setOpen(true)
      }
    }

    function handleFocusOut() {
      // Defer so field-to-field moves (focusout then focusin) do not flicker:
      // by the next frame document.activeElement is the newly focused element.
      window.requestAnimationFrame(() => {
        if (!opensSoftwareKeyboard(document.activeElement)) {
          setOpen(false)
        }
      })
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      body.classList.remove('keyboard-input-open')
    }
  }, [active])
}
