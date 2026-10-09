# My Daily v3 — Task suggestions + push notification setup

## Part A: update your existing GitHub Pages app (quick)

1. Open https://github.com/eveliinaz/My-daily
2. Replace the existing root files with all files in THIS folder. In particular upload index.html, app.js, style.css, sw.js, push-config.js, manifest.webmanifest, icon-192.png, icon-512.png.
3. Commit changes, allow GitHub Pages a few minutes to publish, and reload your installed app. Old tasks use the same `my-daily-v1` storage key and should stay intact on the same device.
4. Tap Add task > Quick add and pick one of the suggestions. You can edit the title, date, time and whether the task repeats before saving.

**Push is NOT operational yet.** The Enable notifications button becomes functional only when Part B below is done. If you want only task suggestions for now, stop here.

## Part B: reminder backend (computer required)

Cloudflare Worker + D1 database, uses the separate `my-daily-push-worker` folder from the ZIP. Developer setup; not guaranteed suitable for a large public launch. Free tiers have limits. No App Store membership required.

1. Install Node.js 22+ from https://nodejs.org and create a free Cloudflare account at https://dash.cloudflare.com .
2. Open a terminal inside `my-daily-push-worker` and run `npm install` then `npx wrangler login`.
3. Create database: `npx wrangler d1 create my-daily-reminders`. Copy the `database_id` from the output into `wrangler.jsonc`, replacing `REPLACE_WITH_DATABASE_ID`.
4. Initialize remote database: `npx wrangler d1 execute my-daily-reminders --remote --file=./schema.sql`.
5. Generate VAPID keys once: `node generate-keys.mjs`. SAVE the public and private keys securely.
6. Set Worker secrets. Run `npx wrangler secret put VAPID_PRIVATE_KEY` and paste PRIVATE key; `npx wrangler secret put VAPID_PUBLIC_KEY` and paste PUBLIC key; `npx wrangler secret put VAPID_CONTACT_EMAIL` and enter your own contact email (without `mailto:`).
7. Deploy: `npx wrangler deploy`. Copy the resulting `https://my-daily-reminders...workers.dev` address.
8. Open `push-config.js` in your *GitHub Pages* repository. Set `apiBase` to the Worker URL and `publicKey` to the generated PUBLIC VAPID key. NEVER publish your private key. Commit.
9. Refresh My Daily's installed iPhone Home Screen app after the GitHub deployment. Open My Daily from its Home Screen icon (not a Safari browser tab), tap Enable notifications, then tap Allow.
10. Create a task due 3-5 minutes from now. Lock your iPhone and see if you receive it. Test both a one-time task and a daily repeating habit.

Important limits: (a) Cloudflare Cron is *approximately* once per minute and can be delayed; notifications are not guaranteed to the exact second. (b) The server expects one device per local storage identity. (c) Existing tasks remain local; task titles and reminder schedules are shared with Cloudflare only after permission is enabled. (d) Notifications require internet at delivery time. (e) iPhone requires iOS 16.4+ and installation as a Home Screen web app. (f) Limit of 150 tasks per device and 500 devices scanned per minute in this prototype. This is a prototype; implement abuse protection, quotas, better retrying, privacy notice and monitoring before sharing with a large audience. (g) Old cached versions may need a Safari reload or re-adding to Home Screen; do not clear website data if you need locally saved tasks.

### Troubleshooting

- "Not connected yet": verify publicKey and apiBase in `push-config.js`, and deploy both GitHub and Worker.
- "Install My Daily": start it from the Home Screen icon; iOS Safari tabs do not support web push subscriptions.
- "Server error": inspect Worker logs using `npx wrangler tail` and verify the database schema and secrets.
- Missed due time: ensure you chose a time in the future and local time zone is correct. Ensure Cloudflare Cron Trigger was deployed.
- Browser still shows old app: refresh installed app, then visit Safari URL; service-worker cache is updated by v3.

Security: PUBLIC VAPID key goes into frontend. PRIVATE key and D1 are Cloudflare secrets/server resources only. Avoid committing private keys. The service is restricted to the listed GitHub Pages origin. User data is on-device until enabling notifications.
