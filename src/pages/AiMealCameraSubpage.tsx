import {
  ArrowLeft,
  Bot,
  Camera,
  ImagePlus,
  RefreshCw,
  Settings,
} from 'lucide-react'
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  IconButton,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import type { GeminiMealAnalysis } from '@domain/geminiMealAnalysis'
import {
  analyzeMealPhoto,
  GeminiMealAnalysisError,
  type GeminiImageInput,
} from '@services/geminiMealAnalysisClient'

type CameraStatus = 'starting' | 'ready' | 'error'

export function AiMealCameraSubpage({
  apiKey,
  onAnalyzed,
  onBack,
}: {
  apiKey: string | null
  onAnalyzed: (analysis: GeminiMealAnalysis) => void
  onBack: () => void
}) {
  const { t } = useLanguage()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraAttemptRef = useRef(0)
  const mountedRef = useRef(true)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<
    | (GeminiImageInput & {
        dataUrl: string
      })
    | null
  >(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisFailed, setAnalysisFailed] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    const attemptId = ++cameraAttemptRef.current
    stopCamera()
    setCapturedPhoto(null)
    setAnalysisError(null)
    setCameraError(null)
    setCameraStatus('starting')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error')
      setCameraError('Camera capture is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      if (!mountedRef.current || attemptId !== cameraAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraStatus('ready')
    } catch (error) {
      if (!mountedRef.current || attemptId !== cameraAttemptRef.current) {
        return
      }
      setCameraStatus('error')
      setCameraError(cameraErrorMessage(error))
    }
  }, [stopCamera])

  useEffect(() => {
    mountedRef.current = true
    const startupId = apiKey
      ? window.setTimeout(() => void startCamera(), 0)
      : null
    return () => {
      if (startupId !== null) {
        window.clearTimeout(startupId)
      }
      mountedRef.current = false
      cameraAttemptRef.current += 1
      stopCamera()
    }
  }, [apiKey, startCamera, stopCamera])

  useEffect(() => {
    if (!analysisFailed) {
      return
    }
    const returnId = window.setTimeout(onBack, 3_000)
    return () => window.clearTimeout(returnId)
  }, [analysisFailed, onBack])

  const analyze = useCallback(
    async (photo: GeminiImageInput) => {
      if (!apiKey) {
        return
      }
      setAnalyzing(true)
      setAnalysisError(null)
      setAnalysisFailed(false)
      try {
        const result = await analyzeMealPhoto({ apiKey, image: photo })
        if (mountedRef.current) {
          onAnalyzed(result)
        }
      } catch (error) {
        if (mountedRef.current) {
          if (
            error instanceof GeminiMealAnalysisError &&
            error.code === 'no_food_detected'
          ) {
            setAnalysisFailed(true)
          } else {
            setAnalysisError(analysisErrorMessage(error))
          }
          setAnalyzing(false)
        }
      }
    },
    [apiKey, onAnalyzed],
  )

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraError('The camera is not ready. Try again.')
      return
    }

    let photo
    try {
      photo = preparePhoto(video, video.videoWidth, video.videoHeight)
    } catch {
      setCameraError('The photo could not be prepared.')
      return
    }
    setCapturedPhoto(photo)
    stopCamera()
    void analyze(photo)
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) {
      return
    }
    setAnalysisError(null)
    setAnalysisFailed(false)
    setCameraError(null)
    cameraAttemptRef.current += 1
    stopCamera()
    try {
      const photo = await prepareUploadedMealPhoto(file)
      if (!mountedRef.current) {
        return
      }
      setCapturedPhoto(photo)
      void analyze(photo)
    } catch {
      if (mountedRef.current) {
        setCameraError('The selected photo could not be prepared.')
      }
    }
  }

  return (
    <section className="ai-meal-camera-subpage subpage-enter">
      <SectionHeader
        title="AI meal camera"
        action={
          <IconButton aria-label="Back to nutrition" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
        }
      />

      {!apiKey ? (
        <div className="ai-camera-setup">
          <StatusMessage tone="warning">
            {t(
              'Add your Gemini API key in Settings before analyzing a meal photo.',
            )}
          </StatusMessage>
          <a className="button button-primary" href="/settings?section=ai-meal">
            <Settings aria-hidden="true" size={18} />
            {t('Open Gemini settings')}
          </a>
        </div>
      ) : (
        <>
          <div className="ai-camera-viewfinder">
            {capturedPhoto ? (
              <img alt={t('Captured meal')} src={capturedPhoto.dataUrl} />
            ) : (
              <video
                aria-label="AI meal camera preview"
                muted
                playsInline
                ref={videoRef}
              />
            )}
            {analyzing ? (
              <div className="ai-camera-progress">
                <div
                  aria-label={t('Analyzing meal')}
                  className="ai-processing-robot"
                  role="status"
                >
                  <span className="ai-processing-numbers" aria-hidden="true">
                    <span>1</span>
                    <span>+</span>
                    <span>0</span>
                    <span>kcal</span>
                  </span>
                  <span className="ai-processing-bot" aria-hidden="true">
                    <Bot size={54} strokeWidth={1.8} />
                  </span>
                  <strong>{t('Crunching the numbers…')}</strong>
                  <span>{t('Building your ingredient estimate')}</span>
                </div>
              </div>
            ) : analysisFailed ? (
              <div className="ai-camera-progress ai-camera-failed" role="alert">
                <Bot aria-hidden="true" size={46} />
                <strong>{t('AI failed')}</strong>
              </div>
            ) : null}
          </div>

          {cameraStatus === 'starting' && !capturedPhoto ? (
            <LoadingState label="Starting camera" />
          ) : null}
          {cameraError ? (
            <StatusMessage tone="warning">{t(cameraError)}</StatusMessage>
          ) : null}
          {analysisError ? (
            <StatusMessage tone="warning">{t(analysisError)}</StatusMessage>
          ) : null}

          <div className="ai-camera-controls">
            <input
              accept="image/*"
              aria-label={t('Choose meal photo from library')}
              className="visually-hidden"
              onChange={(event) => void importPhoto(event)}
              ref={fileInputRef}
              type="file"
            />
            {cameraStatus === 'ready' && !capturedPhoto ? (
              <IconButton
                aria-label="Take meal photo"
                className="ai-camera-shutter"
                onClick={capturePhoto}
              >
                <Camera aria-hidden="true" size={28} />
              </IconButton>
            ) : null}
            {cameraStatus === 'error' && !capturedPhoto ? (
              <PrimaryButton onClick={() => void startCamera()} type="button">
                <RefreshCw aria-hidden="true" size={18} />
                Retry camera
              </PrimaryButton>
            ) : null}
            {!analyzing ? (
              <SecondaryButton
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus aria-hidden="true" size={18} />
                {t('Choose from photos')}
              </SecondaryButton>
            ) : null}
            {capturedPhoto && analysisError && !analyzing ? (
              <>
                <SecondaryButton
                  onClick={() => void startCamera()}
                  type="button"
                >
                  {t('Retake')}
                </SecondaryButton>
                <PrimaryButton
                  onClick={() => void analyze(capturedPhoto)}
                  type="button"
                >
                  {t('Retry analysis')}
                </PrimaryButton>
              </>
            ) : null}
          </div>
          <p className="muted ai-camera-disclaimer">
            {t(
              'Photo nutrition is an estimate. Review every ingredient before logging food.',
            )}
          </p>
        </>
      )}
    </section>
  )
}

async function prepareUploadedMealPhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('The selected file is not an image.')
  }
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  try {
    return preparePhoto(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

function preparePhoto(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) {
  const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('The photo could not be prepared.')
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    dataUrl,
    mimeType: 'image/jpeg' as const,
  }
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera permission was denied. Allow camera access in browser settings and retry.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera was found on this device.'
  }
  return 'The camera could not start. Check camera access and try again.'
}

function analysisErrorMessage(error: unknown) {
  return error instanceof GeminiMealAnalysisError
    ? error.message
    : 'The meal photo could not be analyzed. Try again.'
}
