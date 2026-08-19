import { Dumbbell } from 'lucide-react'

export function AppLaunchScreen() {
  return (
    <main className="app-launch-screen" aria-label="Loading Vigorune">
      <div className="app-launch-content" role="status">
        <div className="app-launch-mark" aria-hidden="true">
          <Dumbbell size={34} strokeWidth={2.25} />
        </div>
        <div className="app-launch-copy">
          <h1>Vigorune</h1>
          <p>Getting everything ready…</p>
        </div>
        <div className="app-launch-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  )
}
