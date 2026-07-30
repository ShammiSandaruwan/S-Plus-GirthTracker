# Buyer Setup Guide - GirthTracker

Thank you for purchasing **GirthTracker**, an offline-first rubber tree girth measurement PWA.

This guide explains how to install, configure, test, and deploy the app.

---

## 1. What You Need

Before starting, make sure you have:

- Node.js v18 or newer
- npm v9 or newer
- A Google account
- A Google Sheet for storing synced measurements
- A static hosting service such as Vercel, Netlify, Cloudflare Pages, or your own server
- Optional: a Bluetooth digital caliper that sends readings as keyboard/HID input

> Important: This app does not use Web Bluetooth pairing inside the browser. It listens for keyboard-style input from calipers that are already paired with the device through Android/iOS/desktop Bluetooth settings.

---

## 2. Install the Project

Extract the purchased ZIP file, open a terminal in the project folder, and run:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the local URL shown in the terminal.

---

## 3. Create Your Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
copy .env.example .env
```

Edit `.env`:

```env
VITE_GAS_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
VITE_ESTATES="Estate A,Estate B,Estate C"
VITE_GAS_SECRET="your_random_secret_here"
VITE_MAINTENANCE_MODE="false"
VITE_DISABLED_MODE="false"
```

### Environment Variable Meaning

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL used for caliper measurement sync & device authorization |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anonymous key |
| `VITE_GAS_URL` | (Optional) Google Apps Script web app URL used for direct sheet exports |
| `VITE_ESTATES` | Comma-separated estate list shown in setup |
| `VITE_GAS_SECRET` | Shared secret that must match the Apps Script secret |
| `VITE_MAINTENANCE_MODE` | Shows a maintenance notice when set to `true` |
| `VITE_DISABLED_MODE` | Blocks app access when set to `true` |

---

## 4. Prepare Google Sheets

1. Create a new Google Sheet.
2. Rename the first sheet if desired.
3. Optional: add these headers in row 1:

| Column | Header |
|---|---|
| A | Estate |
| B | Division |
| C | Field No |
| D | Extent |
| E | Tree No |
| F | Caliper Reading |
| G | Girth |
| H | Timestamp |

4. Copy the Google Sheet ID from the URL.

Example URL:

```text
https://docs.google.com/spreadsheets/d/1ABC123EXAMPLE/edit
```

The Sheet ID is:

```text
1ABC123EXAMPLE
```

---

## 5. Deploy the Google Apps Script Backend

1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Delete the starter code.
4. Copy all code from `google-apps-script.txt` and paste it into Apps Script.
5. Update the estate-to-sheet mapping:

```javascript
const ESTATE_SHEET_MAP = {
  "Estate A": "YOUR_GOOGLE_SHEET_ID_HERE",
  "Estate B": "ANOTHER_GOOGLE_SHEET_ID_HERE"
};
```

6. Set the shared secret:

```javascript
const SHARED_SECRET = "your_random_secret_here";
```

The value must match `VITE_GAS_SECRET` in `.env`.

7. Click **Deploy → New deployment**.
8. Select **Web app**.
9. Set:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
10. Click **Deploy**.
11. Authorize access when Google asks.
12. Copy the Web App URL.
13. Paste the URL into `VITE_GAS_URL` in `.env`.

---

## 6. Test Without a Bluetooth Caliper

You can test the app manually:

1. Run `npm run dev`.
2. Complete the setup screen.
3. Use the manual entry field to enter a caliper reading such as `4.25`.
4. Click **Save**.
5. Confirm that:
   - The tree number increments.
   - The measurement appears in the recent list.
   - Pending count increases.
   - Sync sends data to Google Sheets when online.

You can also simulate HID input by typing numbers while the app screen is focused, then pressing Enter.

---

## 7. Test With a Bluetooth Caliper

1. Pair the caliper through your device Bluetooth settings.
2. Open GirthTracker.
3. Complete the setup screen.
4. Place the caliper on the tree/object.
5. Press the caliper's data-send button.
6. Confirm that the app receives the reading and saves it automatically.

### If Readings Look Wrong

Some calipers send values without decimal points. The app includes a fallback that converts abnormally large values by assuming four decimal places.

Example:

```text
16385 → 1.6385
```

If your caliper uses a different format, adjust the parsing logic in `src/App.jsx`.

---

## 8. Build for Production

```bash
npm run build
```

The production files will be created in the `dist/` directory.

Preview locally:

```bash
npm run preview
```

---

## 9. Deploy to Vercel

1. Push the project to your GitHub account.
2. Sign in to Vercel.
3. Import the repository.
4. Add environment variables in **Project Settings → Environment Variables**.
5. Deploy.
6. Open the deployed HTTPS URL on mobile.
7. Install it as a PWA from the browser prompt/menu.

---

## 10. Deploy to Any Static Host

Build the app:

```bash
npm run build
```

Upload the contents of the `dist/` folder to your host.

Important requirements:

- HTTPS must be enabled.
- The host must serve the generated service worker and manifest files.
- Avoid hosting inside a path that breaks PWA asset URLs unless you update Vite base settings.

---

## 11. Common Problems

### Sync does not work

Check:

- `VITE_GAS_URL` is correct.
- Google Apps Script is deployed as a Web App.
- Access is set to `Anyone`.
- `VITE_GAS_SECRET` matches `SHARED_SECRET`.
- The estate name in the app exactly matches a key in `ESTATE_SHEET_MAP`.

### Data saves locally but does not appear in Google Sheets

Open browser developer tools and check the console/network tab. Also verify Apps Script permissions and deployment version.

### Bluetooth input does not appear

Check:

- The caliper is paired at device level.
- The caliper sends keyboard/HID input.
- The browser/app page is active.
- No text input field is focused during automatic capture.

### App does not install as PWA

Check:

- The app is served over HTTPS.
- The production build is deployed.
- Manifest icons exist in `public/`.
- Browser supports PWA installation.

#### Install button not appearing (Vivo, Samsung Internet, or other browsers)

Some mobile browsers (e.g., Vivo's Funtouch OS default browser, Samsung Internet, some WebView-based browsers) do not fire the `beforeinstallprompt` event. In these cases, the native install button will not appear.

**What happens instead:** The app shows a **fallback install banner** with platform-specific instructions:

| Platform | Guidance |
|---|---|
| **Android (non-Chrome)** | "For the best experience, open this page in Chrome. Or tap ⋮ Menu → Add to Home Screen." |
| **iOS Safari** | "Tap the Share button → Add to Home Screen." |
| **Android Chrome** | "Tap ⋮ Menu → Install app or Add to Home Screen." |
| **Desktop** | "Use Chrome or Edge for the best install experience." |

This banner is **dismissible** (users can tap "Got it") and the dismissal is saved to `localStorage` so it won't reappear.

**Recommended approach for field workers using Vivo phones:**
1. Install **Google Chrome** from the Play Store.
2. Open the GirthTracker URL in Chrome.
3. The native install prompt should appear automatically.

### Old version still appears after update

Use the app's update/reload control or clear site data from the browser settings.

---

## 12. Customization Tips

### Change App Name

Edit `vite.config.js` PWA manifest fields:

```javascript
name: 'Girth Tracker',
short_name: 'GirthTracker'
```

### Change Colors

Edit CSS variables in `src/index.css`:

```css
:root {
  --accent-primary: #059669;
  --accent-hover: #047857;
}
```

### Change Valid Reading Range

Edit `src/App.jsx`:

```javascript
const MIN_READING = 0.5;
const MAX_READING = 30;
```

### Change Google Sheet Columns

Edit `google-apps-script.txt`, especially the `rowsToAppend` array.

---

## 13. Production Checklist

Before using the app in real field work:

- [ ] Replace all placeholder values in `.env`.
- [ ] Replace all placeholder values in `google-apps-script.txt`.
- [ ] Test manual entry.
- [ ] Test Bluetooth caliper input.
- [ ] Test offline save.
- [ ] Test online sync.
- [ ] Test CSV export.
- [ ] Test undo.
- [ ] Test installation on the target mobile device.
- [ ] Confirm Google Sheet receives correct values.
- [ ] Back up the Google Sheet regularly.

---

## 14. Support Boundary

This product includes source code and documentation. It does not include custom deployment, custom feature development, hardware debugging, Google account troubleshooting, or business implementation unless separately agreed with the seller.
