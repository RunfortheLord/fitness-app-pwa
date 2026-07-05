# Web Push Rest-Timer Setup

The installed iPhone Home Screen PWA can schedule a standard iOS notification
for rest-timer completion. QStash holds the delayed job because iOS suspends the
PWA while another app or the Home Screen is active.

## Required services

- Existing Vercel Hobby deployment.
- Free Upstash QStash account.
- No Apple Developer Program membership.

## Environment variables

Generate one VAPID key pair locally:

```powershell
npx web-push generate-vapid-keys --json
```

Add these server-side values to Vercel Production:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`, using a contact URL or `mailto:` address
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `PUBLIC_APP_ORIGIN`, set to the stable production origin

The VAPID public key is returned to the installed PWA by
`GET /api/push/config`. Every other value remains server-only.

## iPhone setup

1. Open the stable origin in Safari.
2. Use **Share > Add to Home Screen**.
3. Open the installed app, then open **Settings**.
4. Select **Enable outside-app timer alerts** and allow notifications.
5. In iPhone **Settings > Notifications**, verify that Sounds are enabled for
   the app.

The notification uses the standard iOS notification sound. Delivery requires
internet access and remains subject to the iPhone notification volume, Silent
Mode, Focus, and notification settings.

## Scheduling behavior

- Starting or resuming a timer schedules one delayed QStash message.
- Pausing, clearing, finishing, or discarding cancels the pending message.
- Adding or subtracting time cancels the previous message and schedules a
  replacement.
- The QStash delivery endpoint verifies the QStash signature before sending Web
  Push.
- Push-subscription data is redacted from QStash logs.
- If the app is visible when the push arrives, the service worker suppresses
  the system notification because the in-app timer sound handles completion.
