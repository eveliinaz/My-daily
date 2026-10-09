# My Daily — free task and habit PWA

This is a complete starter web app for local tasks and daily habits. No framework, payment, account, or backend is required.

## Files
- `index.html` — app layout
- `style.css` — dark purple theme
- `app.js` — tasks, habits, backup, and in-app due reminders
- `manifest.webmanifest` — Home Screen install metadata
- `sw.js` — offline asset caching
- `icon-192.png` and `icon-512.png` — app icons

## Publish free with GitHub Pages (computer recommended)
1. Create a free account at https://github.com.
2. Open https://github.com/new.
3. Set Repository name to `my-daily`, choose **Public**, and click **Create repository**.
4. Click **uploading an existing file** (or **Add file > Upload files**).
5. **Unzip this ZIP first.** Upload all eight files from inside the `my-daily-pwa` directory to the repository ROOT. Do not upload the ZIP itself; do not nest files in another folder.
6. Commit changes.
7. Open the repository **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, Branch **main**, Folder **/(root)**, then **Save**.
8. When the link appears under Pages, open `https://YOUR-USERNAME.github.io/my-daily/` (replace YOUR-USERNAME with your GitHub username).
9. On iPhone, open the site in Safari, tap Share, choose **Add to Home Screen**, ensure it opens as a web app if prompted, and tap Add.
10. Add a task, mark it complete, close/reopen the app, then test in airplane mode AFTER you have loaded the online site at least once.

## What works
- Create, edit and delete tasks.
- One-time tasks with due dates and times.
- Daily habits with completion reset per local calendar day, starting from their selected due date.
- Today, upcoming, and all filters.
- Offline local storage in the browser on the same device.
- Export task JSON and import a previous backup.
- In-app reminder alert only while the page is active and visible.

## Limitations — read this!
- NO reliable lock-screen/background push reminders are implemented. A real iPhone background notification requires Web Push subscription, a service worker push handler, and an always-reachable server that stores subscriptions and sends scheduled encrypted push messages. See https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.
- The app stores data only on the device and browser where tasks were entered. Separate devices do not sync.
- Clearing website data, using private browsing, or uninstalling the web app can delete saved task data. Export backups regularly.
- The on-screen reminder uses JavaScript while the app is open; it is not suitable for important alarms.
- No account, ads, analytics, backend, push service, or paid feature is included.
- GitHub Pages has limits and is suitable for a free open-source personal project, not unlimited or commercial SaaS usage. See https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits.

## Edit text/colors
- Change the app title in `index.html` and `manifest.webmanifest`.
- Change the CSS color hex values in `style.css`.
- Each edit can be made in GitHub's file editor and committed; changes deploy automatically.
- For an updated offline version, change `my-daily-static-v1` in `sw.js` to `my-daily-static-v2` before publishing changes so cached assets refresh.

## Testing without GitHub
On a computer with Python installed, from this folder run: `python -m http.server 8000` and open `http://localhost:8000`. A deployed HTTPS site is needed for a real iPhone Home Screen app.

## Safety
Never post private details, passwords or API keys inside the public repository. Your local tasks are not committed to GitHub by this app, but the static source files are public.
