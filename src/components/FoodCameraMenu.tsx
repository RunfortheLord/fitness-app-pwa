import { Camera, ScanBarcode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { IconButton } from '@components/ui'

export function FoodCameraMenu({
  onOpenAiCamera,
  onOpenScanner,
}: {
  onOpenAiCamera: () => void
  onOpenScanner: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div className="camera-action-menu" ref={menuRef}>
      <IconButton
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open camera options"
        className="camera-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Camera aria-hidden="true" size={24} />
      </IconButton>
      {isOpen ? (
        <div
          aria-label="Camera options"
          className="camera-action-popover"
          role="menu"
        >
          <IconButton
            aria-label="Scan barcode"
            onClick={() => {
              setIsOpen(false)
              onOpenScanner()
            }}
            role="menuitem"
          >
            <ScanBarcode aria-hidden="true" size={25} />
          </IconButton>
          <IconButton
            aria-label="Analyze meal photo"
            className="camera-ai-button"
            onClick={() => {
              setIsOpen(false)
              onOpenAiCamera()
            }}
            role="menuitem"
          >
            <span aria-hidden="true">AI</span>
          </IconButton>
        </div>
      ) : null}
    </div>
  )
}
