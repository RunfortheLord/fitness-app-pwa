import { BrowserMultiFormatReader } from '@zxing/browser'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import type { LocalDateString } from '@domain/dates'
import type { FoodResult } from '@domain/foodSearchSections'
import { foodRepository } from '@repositories/foodRepository'
import { lookupBarcodeProduct } from '@services/foodProviderClient'

import { Sheet } from './Sheet'

export function BarcodeScannerSheet({
  apiKey,
  isOpen,
  onClose,
  onCreateCustom,
  onFound,
}: {
  apiKey: string | null
  isOpen: boolean
  localDate: LocalDateString
  onClose: () => void
  onCreateCustom: (barcode: string) => void
  onFound: (result: FoodResult) => void
}) {
  const videoRef = useState<HTMLVideoElement | null>(null)
  const [video, setVideo] = videoRef
  const [status, setStatus] = useState(
    'Camera access is needed to scan a barcode.',
  )
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const processedRef = useRef(new Set<string>())

  const handleBarcode = useCallback(
    async (barcode: string) => {
      setStatus(`Looking up ${barcode}.`)
      const cached = await foodRepository.getFoodByBarcode(barcode)
      if (cached) {
        onFound({ type: 'local', food: cached.food, section: 'used' })
        return
      }
      if (!navigator.onLine) {
        onCreateCustom(barcode)
        return
      }
      try {
        const response = await lookupBarcodeProduct({
          barcode,
          apiKey: apiKey ?? '',
        })
        const food = await foodRepository.upsertProviderFood(response.result)
        await foodRepository.cacheBarcodeProduct({
          barcode,
          foodId: food.id,
          sourceProvider: response.result.source.provider,
          sourceName: response.result.source.sourceName,
        })
        onFound({
          type: 'external',
          food: { ...response.result, alternates: [] },
        })
      } catch {
        onCreateCustom(barcode)
      }
    },
    [apiKey, onCreateCustom, onFound],
  )

  // Reuse a previously granted camera permission: when the browser reports the
  // camera as already granted, start scanning immediately instead of waiting for
  // another tap on "Request camera access". The Permissions API is not available
  // everywhere (e.g. some iOS Safari versions), so any failure falls back to the
  // manual button, and getUserMedia still gates an actual prompt when needed.
  useEffect(() => {
    if (!isOpen || scanning) {
      return
    }
    const permissions = navigator.permissions
    if (!permissions?.query) {
      return
    }
    let cancelled = false
    void permissions
      .query({ name: 'camera' as PermissionName })
      .then((permissionStatus) => {
        if (!cancelled && permissionStatus.state === 'granted') {
          setStatus('Point the camera at the product barcode.')
          setScanning(true)
        }
      })
      .catch(() => {
        // Permissions API unsupported for "camera"; keep the manual button.
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, scanning])

  useEffect(() => {
    if (!isOpen || !scanning || !video) {
      return
    }
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | null = null
    let stopped = false
    void reader
      .decodeFromVideoDevice(undefined, video, (result) => {
        const barcode = result?.getText()
        if (!barcode || processedRef.current.has(barcode) || stopped) {
          return
        }
        processedRef.current.add(barcode)
        stopped = true
        controls?.stop()
        void handleBarcode(barcode)
      })
      .then((nextControls) => {
        controls = nextControls
      })
      .catch((caught: unknown) => {
        setScanning(false)
        setError(
          caught instanceof Error
            ? permissionMessage(caught)
            : 'Camera scanning is not supported in this browser.',
        )
      })
    return () => {
      stopped = true
      controls?.stop()
      stopVideo(video)
    }
  }, [handleBarcode, isOpen, scanning, video])

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Scan barcode">
      <p className="muted">{status}</p>
      <div className="scanner-frame">
        <video
          ref={setVideo}
          aria-label="Barcode scanner camera preview"
          muted
          playsInline
        />
      </div>
      {error ? <ValidationMessage message={error} /> : null}
      <div className="button-row">
        <PrimaryButton
          type="button"
          onClick={() => {
            processedRef.current = new Set<string>()
            setError(null)
            setStatus('Point the camera at the product barcode.')
            setScanning(true)
          }}
        >
          Request camera access
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={() => {
            setScanning(false)
            if (video) {
              stopVideo(video)
            }
            onClose()
          }}
        >
          Cancel
        </SecondaryButton>
      </div>
    </Sheet>
  )
}

function permissionMessage(error: Error) {
  if (error.name === 'NotAllowedError') {
    return 'Camera permission was denied. Allow camera access in browser settings and retry.'
  }
  if (error.name === 'NotFoundError') {
    return 'No camera was found on this device.'
  }
  return 'Camera scanning is unavailable. Try again from a supported mobile browser.'
}

function stopVideo(video: HTMLVideoElement) {
  for (const track of video.srcObject instanceof MediaStream
    ? video.srcObject.getTracks()
    : []) {
    track.stop()
  }
  video.srcObject = null
}
