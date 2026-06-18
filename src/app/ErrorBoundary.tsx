import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function ErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong while loading this screen.'

  return (
    <main className="app-fallback" aria-labelledby="error-title">
      <h1 id="error-title">Training Log</h1>
      <p>{message}</p>
      <Link className="button button-primary" to="/">
        Return home
      </Link>
    </main>
  )
}
