import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CalorieHistoryChart } from '@components/CalorieHistoryChart'
import { useLanguage } from '@components/languageContextValue'
import {
  Card,
  EmptyState,
  IconButton,
  LoadingState,
  PageContainer,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  StatusMessage,
} from '@components/ui'
import {
  createCalorieInsights,
  type CalorieInsights,
  type CalorieInsightsRange,
  type CalorieInsightsSummary,
} from '@domain/calorieInsights'
import {
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import { calorieHistoryService } from '@services/calorieHistoryService'

const rangeOptions: Array<{
  label: string
  value: CalorieInsightsRange
}> = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
]

type CalorieInsightsState =
  | { status: 'loading' }
  | { status: 'error'; requestKey: string }
  | {
      status: 'ready'
      insights: CalorieInsights
      requestKey: string
    }

export function CalorieInsightsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<CalorieInsightsState>({
    status: 'loading',
  })
  const [retryRevision, setRetryRevision] = useState(0)
  const today = formatLocalDate(new Date())
  const range = parseRange(searchParams.get('range'))
  const endDate = parseEndDate(searchParams.get('end'), today)
  const requestKey = `${range}:${endDate}`
  const currentState =
    state.status !== 'loading' && state.requestKey === requestKey
      ? state
      : ({ status: 'loading' } as const)

  useEffect(() => {
    let isCurrent = true
    void calorieHistoryService
      .getHistory(endDate, range)
      .then((history) => {
        if (!isCurrent) {
          return
        }
        setState({
          status: 'ready',
          requestKey,
          insights: createCalorieInsights({
            history,
            range,
            today: endDate,
          }),
        })
      })
      .catch(() => {
        if (isCurrent) {
          setState({ status: 'error', requestKey })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [endDate, range, requestKey, retryRevision])

  function selectRange(value: string) {
    if (!isCalorieInsightsRange(value)) {
      return
    }
    const next = new URLSearchParams()
    next.set('range', value)
    if (endDate !== today) {
      next.set('end', endDate)
    }
    setSearchParams(next)
  }

  return (
    <PageContainer>
      <SectionHeader
        title={t('Calorie insights')}
        action={
          <IconButton
            aria-label={t('Back to Home')}
            onClick={() => void navigate('/')}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <SegmentedControl
        label={t('Calorie insights range')}
        onChange={selectRange}
        options={rangeOptions}
        value={range}
      />

      {currentState.status === 'loading' ? (
        <LoadingState delayMs={0} label={t('Loading calorie insights')} />
      ) : null}
      {currentState.status === 'error' ? (
        <div className="stack">
          <StatusMessage tone="warning">
            {t('Calorie insights could not load.')}
          </StatusMessage>
          <SecondaryButton
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              setRetryRevision((current) => current + 1)
            }}
          >
            {t('Try again')}
          </SecondaryButton>
        </div>
      ) : null}
      {currentState.status === 'ready' ? (
        <>
          <CalorieSummary summary={currentState.insights.summary} />
          <Card title={t('Daily calories')}>
            <CalorieHistoryChart history={currentState.insights.days} />
            {currentState.insights.summary.daysLogged === 0 ? (
              <EmptyState
                title={t('No calories logged')}
                message={t('Log food in Nutrition to build calorie insights.')}
              />
            ) : null}
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}

function CalorieSummary({ summary }: { summary: CalorieInsightsSummary }) {
  const { language, t } = useLanguage()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  return (
    <Card title={t('Calorie summary')}>
      <div className="summary-grid">
        <span>
          <strong>{summary.consistencyPercentage}%</strong>
          <small>{t('Logging consistency')}</small>
        </span>
        <span>
          <strong>
            {summary.daysLogged} {t('of')} {summary.daysInRange}
          </strong>
          <small>{t('Days logged')}</small>
        </span>
        <span>
          <strong>
            {formatCalorieAverage(
              summary.averageLoggedCalories,
              t('Not available'),
              locale,
            )}
          </strong>
          <small>{t('Average intake')}</small>
        </span>
        <span>
          <strong>
            {formatCalorieAverage(
              summary.averageTargetCalories,
              t('Not available'),
              locale,
            )}
          </strong>
          <small>{t('Average target')}</small>
        </span>
        <span>
          <strong>
            {formatCalorieBalance(
              summary,
              {
                deficit: t('deficit'),
                notAvailable: t('Not available'),
                onTarget: t('On target'),
                surplus: t('surplus'),
              },
              locale,
            )}
          </strong>
          <small>{t('Average vs target')}</small>
        </span>
      </div>
      <p className="muted">
        {t(
          'Consistency counts days with positive calories logged. Averages compare logged intake with the saved target on comparable days.',
        )}
      </p>
    </Card>
  )
}

function formatCalorieAverage(
  value: number | null,
  notAvailable: string,
  locale: string,
) {
  return value === null ? notAvailable : `${formatCalories(value, locale)} kcal`
}

function formatCalorieBalance(
  summary: CalorieInsightsSummary,
  labels: {
    deficit: string
    notAvailable: string
    onTarget: string
    surplus: string
  },
  locale: string,
) {
  if (
    summary.averageDailyCalorieDifference === null ||
    summary.calorieBalance === null
  ) {
    return labels.notAvailable
  }
  if (summary.calorieBalance === 'on_target') {
    return labels.onTarget
  }
  const magnitude = Math.abs(summary.averageDailyCalorieDifference)
  const formattedMagnitude =
    magnitude < 1 ? '<1' : formatCalories(magnitude, locale)
  return `${formattedMagnitude} kcal ${labels[summary.calorieBalance]}`
}

function formatCalories(value: number, locale: string) {
  return Math.round(value).toLocaleString(locale)
}

function parseRange(value: string | null): CalorieInsightsRange {
  return value && isCalorieInsightsRange(value) ? value : '1m'
}

function isCalorieInsightsRange(value: string): value is CalorieInsightsRange {
  return value === '1w' || value === '1m' || value === '3m'
}

function parseEndDate(value: string | null, today: LocalDateString) {
  if (!value || !isLocalDate(value)) {
    return today
  }
  return value > today ? today : value
}

function isLocalDate(value: string): value is LocalDateString {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false
  }
  const parsed = parseLocalDate(value as LocalDateString)
  return Number.isFinite(parsed.getTime()) && formatLocalDate(parsed) === value
}
