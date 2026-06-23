import type { BodyweightLoadMode } from '@shared-types/app'

export function calculateEffectiveLoad(input: {
  bodyweight: number | null
  bodyweightLoadMode: BodyweightLoadMode | null | undefined
  bodyweightPercentage?: number | null
  externalLoad: number
}) {
  if (!Number.isFinite(input.externalLoad)) {
    throw new Error('External load must be finite.')
  }

  const bodyweight = input.bodyweight
  const mode = input.bodyweightLoadMode ?? 'external_weight_only'
  if (mode === 'external_weight_only') {
    return input.externalLoad
  }
  if (bodyweight === null || !Number.isFinite(bodyweight) || bodyweight <= 0) {
    return input.externalLoad
  }
  if (mode === 'bodyweight_plus_external') {
    return bodyweight + input.externalLoad
  }

  const percentage = input.bodyweightPercentage ?? 0
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new Error('Bodyweight percentage must be zero or greater.')
  }
  return bodyweight * (percentage / 100) + input.externalLoad
}
