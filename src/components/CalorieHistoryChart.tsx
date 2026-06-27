import type { DailyCalorieHistory } from '@services/calorieHistoryService'

export function CalorieHistoryChart({
  compact = false,
  history,
}: {
  compact?: boolean
  history: DailyCalorieHistory[]
}) {
  const maxCalories = Math.max(
    1,
    ...history.flatMap((day) => [day.loggedCalories, day.targetCalories]),
  )
  const step = 100 / Math.max(history.length, 1)
  const barWidth = step * 0.62
  const linePoints = history
    .map((day, index) => {
      const x = index * step + step / 2
      const y = 100 - (day.targetCalories / maxCalories) * 100
      return `${x},${y}`
    })
    .join(' ')
  const labelIndexes =
    history.length === 0
      ? []
      : Array.from(
          new Set([
            0,
            Math.floor((history.length - 1) / 2),
            history.length - 1,
          ]),
        )

  return (
    <div
      className={`calorie-history${compact ? ' calorie-history-compact' : ''}`}
    >
      <div className="calorie-chart-legend" aria-hidden="true">
        <span className="calorie-legend-logged">Logged</span>
        <span className="calorie-legend-target">Target</span>
      </div>
      <svg
        aria-label="Daily calories logged and target graph"
        className="calorie-history-chart"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        <line className="calorie-grid-line" x1="0" x2="100" y1="50" y2="50" />
        {history.map((day, index) => {
          const height = (day.loggedCalories / maxCalories) * 100
          const x = index * step + (step - barWidth) / 2
          return (
            <rect
              className="calorie-bar"
              height={height}
              key={day.localDate}
              width={barWidth}
              x={x}
              y={100 - height}
            >
              <title>{`${day.localDate}: ${Math.round(
                day.loggedCalories,
              )} kcal logged, ${Math.round(day.targetCalories)} kcal target`}</title>
            </rect>
          )
        })}
        {history.length > 1 ? (
          <polyline className="calorie-target-line" points={linePoints} />
        ) : null}
      </svg>
      <div className="calorie-chart-dates" aria-hidden="true">
        {labelIndexes.map((index) => (
          <span key={history[index]?.localDate}>
            {shortDate(history[index]?.localDate)}
          </span>
        ))}
      </div>
      <p className="visually-hidden">
        {history
          .map(
            (day) =>
              `${day.localDate}: ${Math.round(
                day.loggedCalories,
              )} calories logged, ${Math.round(day.targetCalories)} target.`,
          )
          .join(' ')}
      </p>
    </div>
  )
}

function shortDate(localDate: string | undefined) {
  if (!localDate) {
    return ''
  }
  const [, month, day] = localDate.split('-')
  return `${Number(month)}/${Number(day)}`
}
