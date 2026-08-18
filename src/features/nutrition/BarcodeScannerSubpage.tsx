import { ArrowLeft, Camera, ScanLine, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BrowserMultiFormatReader } from '@zxing/browser'

import {
  IconButton,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import type { FoodResult } from '@domain/foodSearchSections'
import { foodRepository } from '@repositories/foodRepository'
import { lookupBarcodeProduct } from '@services/foodProviderClient'

const CAMERA_GRANTED_STORAGE_KEY = 'fitness-log.camera-permission-granted'

export function BarcodeScannerSubpage({
  apiKey,
  onBack,
  onCreateCustom,
  onFound,
}: {
  apiKey: string | null
  onBack: () => void
  onCreateCustom: (barcode: string) => void
  onFound: (result: FoodResult) => void
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState(() =>
    window.localStorage.getItem(CAMERA_GRANTED_STORAGE_KEY) === 'true'
      ? 'Center the barcode inside the frame.'
      : 'Ready to scan a product barcode.',
  )
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(
    () => window.localStorage.getItem(CAMERA_GRANTED_STORAGE_KEY) === 'true',
  )
  const processedRef = useRef(new Set<string>())

  const handleBarcode = useCallback(
    async (barcode: string) => {
      setStatus(`Barcode ${barcode} found. Looking up the food…`)
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

  useEffect(() => {
    if (!scanning || !video) {
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
        window.localStorage.setItem(CAMERA_GRANTED_STORAGE_KEY, 'true')
      })
      .catch((caught: unknown) => {
        setScanning(false)
        const scannerError =
          caught instanceof Error
            ? caught
            : new Error('Camera scanning is not supported in this browser.')
        if (scannerError.name === 'NotAllowedError') {
          window.localStorage.removeItem(CAMERA_GRANTED_STORAGE_KEY)
        }
        setError(permissionMessage(scannerError))
      })

    return () => {
      stopped = true
      controls?.stop()
      stopVideo(video)
    }
  }, [handleBarcode, scanning, video])

  function startScanning() {
    processedRef.current = new Set<string>()
    setError(null)
    setStatus('Center the barcode inside the frame.')
    setScanning(true)
  }

  function returnToNutrition() {
    setScanning(false)
    if (video) {
      stopVideo(video)
    }
    onBack()
  }

  return (
    <section
      aria-labelledby="barcode-scanner-title"
      className="barcode-scanner-subpage subpage-enter"
    >
      <header className="barcode-scanner-header">
        <IconButton aria-label="Back to nutrition" onClick={returnToNutrition}>
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <div>
          <p className="eyebrow">Nutrition</p>
          <h2 id="barcode-scanner-title">Scan barcode</h2>
        </div>
      </header>

      <div className={`scanner-viewfinder${scanning ? ' is-scanning' : ''}`}>
        <video
          ref={setVideo}
          aria-label="Barcode scanner camera preview"
          muted
          playsInline
        />
        {!scanning ? (
          <div className="scanner-placeholder" aria-hidden="true">
            <Camera size={42} strokeWidth={1.5} />
          </div>
        ) : null}
        <div className="scanner-target" aria-hidden="true">
          <ScanLine size={28} />
        </div>
      </div>

      <div className="scanner-status" aria-live="polite">
        <strong>{scanning ? 'Scanning…' : 'Camera ready when you are'}</strong>
        <p>{status}</p>
      </div>

      {error ? <ValidationMessage message={error} /> : null}

      {!scanning ? (
        <PrimaryButton type="button" onClick={startScanning}>
          {error ? 'Try camera again' : 'Enable camera'}
        </PrimaryButton>
      ) : (
        <SecondaryButton type="button" onClick={() => setScanning(false)}>
          Stop scanning
        </SecondaryButton>
      )}

      <div className="scanner-privacy-note">
        <ShieldCheck aria-hidden="true" size={20} />
        <p>
          Video stays on this device. The app remembers a successful permission
          so you do not need to enable the camera again.
        </p>
      </div>
    </section>
  )
}

function permissionMessage(error: Error) {
  if (error.name === 'NotAllowedError') {
    return 'Camera access is blocked. Allow it in your browser settings, then try again.'
  }
  if (error.name === 'NotFoundError') {
    return 'No camera was found on this device.'
  }
  return 'Camera scanning is unavailable. Try a supported mobile browser.'
}

function stopVideo(video: HTMLVideoElement) {
  const stream =
    typeof MediaStream !== 'undefined' && video.srcObject instanceof MediaStream
      ? video.srcObject
      : null
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
  video.srcObject = null
}
