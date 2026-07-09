<p align="center">
  <img src="public/pwa-192x192.png" alt="GirthTracker Logo" width="96" />
</p>

<h1 align="center">🌿 GirthTracker - Rubber Tree Girth Tracker PWA</h1>

<p align="center">
  <strong>An offline-first Progressive Web App built for rubber estate field workers to measure and record tree girth using Bluetooth digital calipers.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/PWA-Offline--First-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/IndexedDB-Dexie.js-FF6600?logo=databricks&logoColor=white" alt="Dexie.js" />
  <img src="https://img.shields.io/badge/Backend-Google%20Apps%20Script-34A853?logo=googlesheets&logoColor=white" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?logo=shield&logoColor=white" alt="Proprietary" />
  <img src="https://img.shields.io/badge/By-S%20Plus%20Solutions-0078D4?logo=globe&logoColor=white" alt="S Plus Solutions" />
</p>

---

## 📖 Overview

**GirthTracker** is a field-ready, installable web application designed specifically for rubber estate operations. Field workers can measure tree girth using industrial Bluetooth calipers (e.g., SYNTEK IP67) that emulate a Bluetooth keyboard (HID profile). The app captures caliper readings **hands-free** (no tapping or focusing required), calculates the girth automatically, stores data offline, and syncs everything to Google Sheets when connectivity is restored.

---

## ⚡ How It Works - End-to-End Automation

GirthTracker replaces the **entire traditional census workflow** with a single, streamlined digital pipeline:

```
📏 Bluetooth Caliper ──▶ 📱 GirthTracker App ──▶ 📊 Google Sheet (Estate-wise) ──▶ 📋 Google Sheet (Summary)
      (Field)                (Capture & Sync)           (Raw Data per Estate)              (Auto-generated)
```

### The Traditional Process (What You No Longer Need)

| Step | Old Way | With GirthTracker |
|---|---|---|
| **1. Measurement** | Manually read caliper and write in a field book | Bluetooth caliper sends reading directly to the app - **hands-free** |
| **2. Recording** | Copy readings from field book to a register | App auto-calculates girth, tags GPS, and stores locally - **instant** |
| **3. Data Entry** | Re-enter register data into Excel spreadsheets | Auto-syncs to per-estate Google Sheets when online - **zero re-entry** |
| **4. Summarization** | Manually create summary reports across estates | Google Sheets formulas and apps script generate summaries - **fully automated** |
| **5. Backup & Access** | Physical books risk damage, loss, and limited access | Cloud-stored, accessible anywhere, real-time - **always safe** |

### Why This Matters

> **The only manual step is the census itself** - placing the caliper on each tree and pressing the send button. Everything downstream - recording, data entry, validation, syncing, and summarization - is handled automatically by GirthTracker and Google Sheets.

**Key benefits at a glance:**

- 💰 **Massive Clerical Time Savings** - Eliminate hundreds of hours of manual data entry and cross-checking by office staff. This is a direct cost saving that easily covers subscription costs.
- 🚫 **No manual data re-entry** - Readings flow directly from caliper to cloud, skipping the field book and register.
- 🚫 **No manual summary creation** - Estate-level and cross-estate summaries are auto-generated instantly.
- ✅ **Zero transcription errors** - Completely removes human mistakes that happen when copying from book → register → spreadsheet.
- ✅ **Real-time visibility** - Management can monitor census progress and field insights as they happen.
- ✅ **Works fully offline** - Data is safely stored locally and syncs automatically when the worker returns to network coverage.
---

## ✨ Features

| Feature | Description |
|---|---|
| 📴 **Offline-First** | Full PWA with Service Workers. Works without internet; all data persisted locally in IndexedDB. |
| 📡 **Bluetooth Caliper Integration** | Listens globally for Bluetooth HID keystrokes from industrial calipers. Completely hands-free. |
| 🔢 **Auto Calculations** | Automatically computes `Girth = Caliper Reading × π` and increments the tree number. |
| ☁️ **Background Sync** | Auto-detects connectivity and syncs pending records to Google Sheets. Periodic retry every 30 seconds. |
| 🛡️ **Shared-Secret Auth** | Secures the Google Apps Script endpoint with a configurable shared secret. |
| ⚠️ **Range Validation** | Rejects caliper readings outside the configurable 0.5–30 inch valid range. |
| ↩️ **Undo with Confirmation** | Two-tap undo to prevent accidental deletions. Restores the tree number. |
| ✏️ **Manual Entry Fallback** | In case Bluetooth fails, manually type a caliper reading. |
| 📊 **CSV Export** | Export all local measurement data as a `.csv` file for offline analysis. |
| 📱 **Installable PWA** | Install directly on Android/iOS home screen. Includes custom icons and standalone display. |
| 🔒 **Screen Wake Lock** | Keeps the screen awake during field use via the Wake Lock API, re-acquired on visibility change. |
| 🏗️ **Multi-Estate Support** | Route synced data to different Google Sheets based on the estate name. |
| 📳 **Haptic Feedback** | Vibration on successful measurement save for non-visual confirmation. |
| 🔊 **Sound Confirmation** | Audible success beep on save and warning beep for invalid/out-of-range readings. Toggleable in setup. |
| 📍 **GPS Tagging** | Background GPS capture at configurable intervals. Each measurement is tagged with coordinates, accuracy, and a Google Maps link. |
| 🌴 **Tapping Recommendation** | Classifies each tree as Tappable, Approaching, or Below tapping size based on configurable girth threshold (cm). |
| 📊 **Abnormal Reading Detection** | Z-score analysis flags statistically outlier readings within a session. Configurable sensitivity. |
| 📝 **Session Reports** | Generate field session summary reports with stats, tapping status, and sync status. Share via WhatsApp or native share. |
| 📈 **Field Insights** | In-app analytics modal with girth distribution chart, tappable/approaching counts, min/max/average stats. Accessible via button or `?gt_insights=1`. |
| 🗺️ **Field GPS Map** | Interactive Leaflet map with marker clustering, tapping-status color coding, re-center control, GPS accuracy overlay, and map legend. |
| 🔐 **Access Approval Gate** | Device-level access control via Google Apps Script with GPS capture, token expiration, and **multi-supervisor Telegram notifications**. |
| 📱 **QR Code Setup** | Admin can generate QR codes for specific fields. Workers scan them to pre-fill their entire app setup instantly. |
| 🔄 **Start New Field Wizard** | Switch to a new division/field/extent mid-session without losing existing data or operator context. |
| ⚡ **High-Contrast Dark UI** | Premium dark-mode design optimized for outdoor readability and OLED battery savings. |
| 🔧 **Maintenance & Disable Modes** | Remotely toggle maintenance notices or fully disable access via environment variables. |
| 🛠️ **Admin Dashboard** | TOTP-secured admin panel at `/mod` with estate data loading, status filters, measurement stats, GPS field map, and **full device management** (list/revoke devices). |


---

## 📦 Release Notes

**v1.3.0 - Admin & Workflow Upgrades**
- Added **QR Code Generator** in Admin Dashboard for quick field setup
- Added **Device Management** view in Admin Dashboard to list and revoke active devices
- Upgraded **Telegram Notifications** to support multi-supervisor approvals (comma-separated chat IDs)
- App automatically parses URL parameters to pre-fill field setup form

**v1.2.0 - Field Workflow Upgrade**
- Added Sound Confirmation toggle
- Added success beep after saved measurement
- Added warning beep for invalid/out-of-range readings
- Added Start New Field wizard
- Improved Start New Field modal responsiveness on mobile
- Preserves estate, approval, operator, and old measurements when moving to a new field

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│          Field Worker Device         │
│                                     │
│  ┌──────────┐     ┌──────────────┐  │
│  │ Bluetooth │────▶│ GirthTracker │  │
│  │  Caliper  │ HID │   (React)    │  │
│  └──────────┘     └──────┬───────┘  │
│                          │          │
│                   ┌──────▼───────┐  │
│                   │  IndexedDB   │  │
│                   │  (Dexie.js)  │  │
│                   └──────┬───────┘  │
└──────────────────────────┼──────────┘
                           │  Auto-sync when online
                    ┌──────▼───────┐
                    │  Google Apps  │
                    │    Script     │
                    │  (Serverless) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Google Sheets │
                    │  (Per-Estate) │
                    └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **UI Framework** | [React](https://react.dev/) | 19.x |
| **Build Tool** | [Vite](https://vitejs.dev/) | 8.x |
| **PWA Plugin** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | 1.x |
| **Local Database** | [Dexie.js](https://dexie.org/) (IndexedDB wrapper) | 4.x |
| **Icons** | [Lucide React](https://lucide.dev/) | 1.x |
| **Styling** | Vanilla CSS with CSS Custom Properties | - |
| **Cloud Backend** | [Google Apps Script](https://developers.google.com/apps-script) | - |
| **Data Store** | [Google Sheets](https://sheets.google.com) | - |
| **Linting** | [ESLint](https://eslint.org/) | 10.x |
| **Hosting** | [Vercel](https://vercel.com/) *(recommended)* | - |

---

## 📁 Project Structure

```
S-Plus-GirthTracker/
├── public/
│   ├── favicon.svg            # App favicon
│   ├── icons.svg              # SVG icon sprite
│   ├── pwa-192x192.png        # PWA icon (192×192)
│   └── pwa-512x512.png        # PWA icon (512×512, maskable)
├── src/
│   ├── assets/                # Static assets
│   ├── components/
│   │   ├── AccessGate.jsx     # Device access approval gate
│   │   ├── AdminPage.jsx      # TOTP-secured admin dashboard
│   │   ├── FieldInsightsModal.jsx  # Field analytics & insights
│   │   ├── FieldMap.jsx       # Collapsible GPS field map
│   │   ├── MeasurementMap.jsx # Leaflet map with clustering
│   │   └── SessionReport.jsx  # Session report generator
│   ├── services/
│   │   ├── accessControl.js   # Device ID, access request & token mgmt
│   │   ├── analytics.js       # Abnormal detection & field insights
│   │   ├── location.js        # Background GPS capture & refresh
│   │   ├── recommendation.js  # Tapping recommendation classifier
│   │   └── reports.js         # Session report generation & sharing
│   ├── App.jsx                # Main application component
│   ├── db.js                  # Dexie.js database schema
│   ├── index.css              # Global styles & design system
│   ├── main.jsx               # React entry point
│   ├── utils.js               # Core measurement utilities
│   └── utils.test.js          # Unit tests for utilities
├── docs/                      # Documentation assets
├── .env.example               # Environment variable template
├── google-apps-script.txt     # Backend GAS code (copy to Apps Script)
├── index.html                 # HTML entry point
├── vercel.json                # Vercel routing configuration
├── vite.config.js             # Vite + PWA configuration
├── eslint.config.js           # ESLint configuration
├── LICENSE                    # Proprietary license file
└── package.json               # Dependencies & scripts
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **v18+**
- [npm](https://www.npmjs.com/) **v9+**
- A Google Account (for Google Sheets sync)
- A Bluetooth digital caliper with HID profile *(optional for testing)*

### Installation

```bash
# 1. Extract the downloaded archive and enter the project directory
cd girth-tracker

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env
# (On Windows: copy .env.example .env)

# 4. Configure your .env file (see Environment Variables below)

# 5. Start the development server
npm run dev
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check for code issues |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (use `.env.example` as a template):

| Variable | Required | Description |
|---|---|---|
| `VITE_GAS_URL` | ✅ | Your deployed Google Apps Script Web App URL |
| `VITE_ESTATES` | ❌ | Comma-separated estate names. Converts the Estate field from text input to a dropdown. |
| `VITE_GAS_SECRET` | ❌ | Shared secret for securing the GAS endpoint. Must match `SHARED_SECRET` in the GAS script. |
| `VITE_REQUIRE_ACCESS_APPROVAL` | ❌ | Set to `"true"` to require device-level access approval before app use. |
| `VITE_REQUIRE_GPS_FOR_APPROVAL` | ❌ | Set to `"true"` to require GPS location capture during the access request. |
| `VITE_ENABLE_GPS_TAGGING` | ❌ | Set to `"true"` to tag each measurement with GPS coordinates and Google Maps link. |
| `VITE_GPS_REFRESH_INTERVAL_SECONDS` | ❌ | GPS refresh interval in seconds during a session. Default: `180`. Minimum: `30`. |
| `VITE_ENABLE_SESSION_REPORTS` | ❌ | Set to `"true"` to enable the Session Report button for generating and sharing field reports. |
| `VITE_SHOW_FIELD_INSIGHTS_BUTTON` | ❌ | Controls whether the Insights button is visible in the Recent section. Even if hidden, admin can open Field Insights using `?gt_insights=1`. |
| `VITE_ENABLE_ABNORMAL_ALERTS` | ❌ | Set to `"true"` to enable z-score based abnormal reading detection alerts. |
| `VITE_ABNORMAL_Z_SCORE` | ❌ | Z-score threshold for flagging abnormal readings. Default: `2`. |
| `VITE_ENABLE_TAPPING_RECOMMENDATION` | ❌ | Set to `"true"` to enable tapping readiness classification for each measurement. |
| `VITE_TAPPABLE_GIRTH_CM` | ❌ | Girth threshold (cm) at or above which a tree is classified as tappable. Default: `50`. |
| `VITE_APPROACHING_MARGIN_CM` | ❌ | Margin below the tappable threshold (cm) for "approaching" classification. Default: `5`. |
| `VITE_MAINTENANCE_MODE` | ❌ | Set to `"true"` to display a maintenance notice instead of the app. |
| `VITE_DISABLED_MODE` | ❌ | Set to `"true"` to fully block access with a security notice. Takes precedence over maintenance mode. |
| `VITE_APP_VERSION` | ❌ | App version string displayed in the footer. Default: `1.3.0`. |

```env
VITE_GAS_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
VITE_ESTATES="Estate A,Estate B,Estate C"
VITE_GAS_SECRET="a_strong_random_password"
VITE_REQUIRE_ACCESS_APPROVAL="true"
VITE_REQUIRE_GPS_FOR_APPROVAL="false"
VITE_ENABLE_GPS_TAGGING="true"
VITE_GPS_REFRESH_INTERVAL_SECONDS="180"
VITE_ENABLE_SESSION_REPORTS="true"
VITE_SHOW_FIELD_INSIGHTS_BUTTON="false"
VITE_ENABLE_ABNORMAL_ALERTS="true"
VITE_ABNORMAL_Z_SCORE="2"
VITE_ENABLE_TAPPING_RECOMMENDATION="true"
VITE_TAPPABLE_GIRTH_CM="50"
VITE_APPROACHING_MARGIN_CM="5"
VITE_MAINTENANCE_MODE="false"
VITE_DISABLED_MODE="false"
VITE_APP_VERSION="1.3.0"
```

> **Vercel Users:** Add these variables in **Project Settings → Environment Variables** instead of using a `.env` file.

---

## ☁️ Google Sheets Integration

### Step-by-Step Setup

1. **Create** a new Google Sheet (or open an existing one).
2. Navigate to **Extensions → Apps Script**.
3. **Replace** the default `function myFunction() {...}` with the contents of [`google-apps-script.txt`](google-apps-script.txt).
4. In the script, update the `ESTATE_SHEET_MAP` object:
   ```javascript
   const ESTATE_SHEET_MAP = {
     "Your Estate Name": "YOUR_GOOGLE_SHEET_ID",
     // The Sheet ID is the long string in the URL:
     // https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
   };
   ```
5. *(Optional)* Set `SHARED_SECRET` to a strong random string and match it with `VITE_GAS_SECRET` in your `.env`.
6. Click **Deploy → New deployment**.
7. Select **Web app** as the type.
8. Configure:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
9. Click **Deploy** and authorize the script when prompted.
10. **Copy** the Web App URL and paste it into `VITE_GAS_URL` in your `.env`.

### Data Schema (Google Sheet Columns)

| Column | Field |
|---|---|
| A | Estate |
| B | Division |
| C | Field No |
| D | Extent (Ha) |
| E | Tree Number |
| F | Caliper Reading (in) |
| G | Girth (in) |
| H | Date |
| I | Tapping Recommendation |
| J | Abnormal Flag |
| K | Abnormal Reason |
| L | Latitude |
| M | Longitude |
| N | GPS Accuracy |
| O | Google Map Link |

**⚠️ Important Test Data Cleanup Note:** 
For clean testing with the updated column order, you must use a new blank Google Sheet or completely clear any old test data in your existing mapped estate sheets. Old sheets with different headers will misalign new records.

---

## 📱 Usage Guide

### Initial Setup
1. Open the app and fill in your **Estate**, **Division**, **Field No**, **Extent**, and **Starting Tree Number**.
2. Tap **Save & Start Measuring**.

### Taking Measurements
1. **Pair** your Bluetooth caliper in your device's Bluetooth settings.
2. Place the caliper on the tree and press the **Data Send** button.
3. The app automatically:
   - Receives the Bluetooth HID keystroke
   - Validates the reading (0.5-30 inch range)
   - Calculates girth (`reading × π`)
   - Saves to local IndexedDB
   - Increments the tree number
   - Provides haptic feedback (vibration)
4. If Bluetooth isn't available, use the **Manual Entry** form.

### Field GPS Map
Field GPS Map now supports:

* Auto-fit bounds
* Marker clustering
* Re-center control
* GPS accuracy overlay
* Map legend

Also note:
GPS locations are approximate and depend on device accuracy. Accuracy circles show estimated GPS confidence where available.

### Syncing Data
- When online, the app **auto-syncs** pending measurements to Google Sheets.
- Tap the **Pending** counter to trigger a manual sync.
- Failed syncs can be retried by tapping the **Failed** counter or the error banner.

### Undo & Adjustments
- **Undo Last:** Tap once to show confirmation, tap again to delete the last measurement and restore the tree number.
- **Tree ±:** Use the `−` / `+` buttons to manually adjust the current tree number.
- **Setup:** Tap once to show confirmation, tap again to return to the setup screen.

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Add your environment variables in **Project Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Vite and handles the build.

> **Preview Testing Note:** Because Vercel preview runs under a separate domain, IndexedDB data from localhost or the main production domain will not appear. Users must approve access (if using auth) and create new measurements in the preview URL to test offline features and mapping.

### Manual / Self-Hosted

```bash
npm run build
```

Serve the `dist/` directory with any static file server. Ensure HTTPS is enabled (required for PWA + Service Worker).

---

## 📄 License

© 2026 **[S Plus Solutions](https://www.splussolutions.com)**. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without prior written permission from S Plus Solutions.

---

<p align="center">
  Built with ❤️ by <a href="https://www.splussolutions.com"><strong>S Plus Solutions</strong></a> for the rubber plantation industry
</p>
