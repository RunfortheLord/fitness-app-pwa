import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = 'August 18, 2026'

function PublicPage({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <main className="public-info-page">
      <article className="public-info-card">
        <p className="eyebrow">Vigorune</p>
        <h1>{title}</h1>
        {children}
        <nav className="public-info-links" aria-label="Legal and support">
          <Link to="/privacy">Privacy</Link>
          <Link to="/account-deletion">Account deletion</Link>
          <Link to="/support">Support</Link>
          <Link to="/settings?section=about">Open Vigorune</Link>
        </nav>
      </article>
    </main>
  )
}

export function PrivacyPolicyPage() {
  return (
    <PublicPage title="Privacy Policy">
      <p className="muted">Effective {EFFECTIVE_DATE}</p>
      <p>
        Vigorune is a local-first fitness tracker. You can use its core workout,
        nutrition, bodyweight, and running features without creating an account.
      </p>

      <h2>Information kept on your device</h2>
      <p>
        Workout programs and history, nutrition entries, bodyweight records,
        running records and GPS samples, preferences, and API-key settings are
        stored in this device's application storage. Clearing the app or browser
        storage can remove this information. You can create a local JSON backup
        before clearing it.
      </p>

      <h2>Optional account and cloud backup</h2>
      <p>
        If you choose Google or Apple sign-in, Supabase processes your identity
        and account session. If cloud backup is enabled, Vigorune uploads a
        replaceable fitness snapshot and daily nutrition totals associated with
        your account. A snapshot can include workout, nutrition, bodyweight, and
        run-summary information; detailed GPS samples remain device-local and
        are excluded from cloud snapshots. Cloud backup is not realtime
        synchronization and is not required to use the app.
      </p>

      <h2>Meal-photo analysis and food lookup</h2>
      <p>
        A meal image and optional note leave your device only when you
        explicitly request AI analysis. They are sent through Vigorune's server
        to its configured AI provider, currently OpenAI, to produce an estimate
        for your review. Images are not included in local or cloud backups and
        results are not logged until you accept them. Food searches may send
        search terms or barcodes to USDA FoodData Central and Open Food Facts.
      </p>

      <h2>Feedback and technical information</h2>
      <p>
        If you submit feedback, Vigorune sends the text you enter together with
        limited app version, build, language, online-status, and device/browser
        context to the developer's configured feedback service. Vigorune does
        not sell personal information or use fitness records for advertising.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Local information remains until you clear it, uninstall the app, or the
        operating system removes its storage. Cloud snapshots remain until they
        are replaced or you delete cloud data or your account. Deleting an
        account deletes its Supabase identity and associated cloud rows; local
        data on each device remains until separately cleared.
      </p>

      <h2>Your choices</h2>
      <p>
        You may remain signed out, deny optional camera, location, motion, or
        notification permissions, export local data, delete cloud data, delete
        your account, or clear local device data from Settings. See the{' '}
        <Link to="/account-deletion">account deletion instructions</Link> for
        the deletion pathway.
      </p>
    </PublicPage>
  )
}

export function AccountDeletionPage() {
  return (
    <PublicPage title="Delete your Vigorune account">
      <p>
        To permanently delete your account, open Vigorune, go to{' '}
        <strong>Settings → Data → Cloud backup</strong>, sign in if necessary,
        select <strong>Delete account</strong>, and complete the confirmation.
      </p>
      <p>
        Account deletion removes the Supabase authentication account and its
        cloud backup and daily nutrition rows. It signs the device out. Workout,
        nutrition, bodyweight, and running information stored locally on your
        devices is deliberately retained so an account deletion cannot erase the
        only copy of your fitness history.
      </p>
      <p>
        To remove local information too, use <strong>Clear all data</strong> on
        each device after deleting the account. Export a JSON backup first if
        you may want that information later.
      </p>
      <p>
        Apple users may also revoke Vigorune under their Apple Account's Sign in
        with Apple settings. This is separate from deleting Vigorune's account
        and cloud data.
      </p>
      <p>
        <Link className="button button-primary" to="/settings?section=data">
          Open account controls
        </Link>
      </p>
    </PublicPage>
  )
}

export function SupportPage() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim()
  const feedbackEnabled =
    import.meta.env.VITE_FEEDBACK_ENABLED?.trim().toLowerCase() === 'true'
  return (
    <PublicPage title="Vigorune Support">
      {feedbackEnabled ? (
        <p>
          For help, open <strong>Settings → About → Send feedback</strong> and
          describe the problem. Include what you expected, what happened, and
          the steps that reproduce it. Do not include passwords, API keys, or
          private authentication codes.
        </p>
      ) : null}
      {supportEmail ? (
        <p>
          For help, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      ) : (
        <p>
          A public support contact will appear here before the App Store
          release. The troubleshooting and data-protection guidance below is
          available now.
        </p>
      )}
      <h2>Health information</h2>
      <p>
        Vigorune is a fitness logging tool, not a medical device. It does not
        diagnose, treat, cure, or prevent any medical condition. Consult a
        qualified healthcare professional for medical advice, diagnosis, or
        treatment.
      </p>
      <h2>Before troubleshooting storage</h2>
      <p>
        Export a JSON backup before uninstalling the app, clearing browser data,
        replacing local data, or resetting a device. Signing out does not delete
        local fitness information.
      </p>
    </PublicPage>
  )
}
