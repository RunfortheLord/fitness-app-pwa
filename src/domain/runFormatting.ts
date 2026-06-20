import { METERS_PER_MILE } from './runTracking'

export function formatDistance(distanceMeters: number) {
  return `${(distanceMeters / METERS_PER_MILE).toFixed(2)} mi`
}

export function formatPace(secondsPerMile: number | null) {
  if (!secondsPerMile || !Number.isFinite(secondsPerMile)) {
    return '--'
  }
  return `${formatDuration(secondsPerMile)}/mi`
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
