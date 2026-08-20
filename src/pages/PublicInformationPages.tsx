import { Link } from 'react-router-dom'

import { PublicPage } from '@pages/PublicPage'

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
  const supportEmail =
    import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'adamshugart31@gmail.com'
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
      <p>
        For help, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
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
