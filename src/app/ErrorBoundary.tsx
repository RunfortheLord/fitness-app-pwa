import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function ErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong while loading this screen.'

  return (
    <main className="app-fallback" aria-labelledby="error-title">
      <h1 id="error-title">Vigorune</h1>
      <p>{message}</p>
      <p className="muted">
        Your saved data is still on this device. Reload the app, or open Data &
        backup to export a recovery copy.
      </p>
      <div className="button-row">
        <button
          className="button button-primary"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload app
        </button>
        <Link className="button button-secondary" to="/settings?section=data">
          Data &amp; backup
        </Link>
        <Link className="button button-secondary" to="/">
          Return home
        </Link>
      </div>
    </main>
  )
}
