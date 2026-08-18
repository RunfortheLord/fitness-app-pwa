import { Camera, ScanBarcode } from 'lucide-react'
import { useEffect, useState } from 'react'

import { IconButton } from '@components/ui'
import { useLanguage } from '@components/languageContextValue'

export function FoodCameraMenu({
  onOpenAiCamera,
  onOpenScanner,
}: {
  onOpenAiCamera: () => void
  onOpenScanner: () => void
}) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div className={`camera-action-menu${isOpen ? ' is-open' : ''}`}>
      <IconButton
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open camera options"
        className="camera-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Camera aria-hidden="true" size={24} />
      </IconButton>
      <div
        aria-hidden={!isOpen}
        aria-label="Camera options"
        className={`camera-action-popover${isOpen ? ' is-open' : ''}`}
        inert={!isOpen}
        role="menu"
      >
        <button
          aria-label="Scan barcode"
          className="camera-menu-item"
          onClick={() => {
            setIsOpen(false)
            onOpenScanner()
          }}
          role="menuitem"
          type="button"
        >
          <span className="camera-menu-item-icon">
            <ScanBarcode aria-hidden="true" size={20} />
          </span>
          <span>{t('Scan barcode')}</span>
        </button>
        <button
          aria-label="Analyze meal photo"
          className="camera-menu-item"
          onClick={() => {
            setIsOpen(false)
            onOpenAiCamera()
          }}
          role="menuitem"
          type="button"
        >
          <span aria-hidden="true" className="camera-menu-item-icon camera-ai">
            AI
          </span>
          <span>{t('Analyze meal photo')}</span>
        </button>
      </div>
    </div>
  )
}
