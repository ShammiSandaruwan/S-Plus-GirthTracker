<p align="center">
  <img src="public/logo.png" alt="GirthTracker Logo" width="96" />
</p>

<h1 align="center">🌿 GirthTracker - Rubber Tree Girth Tracker PWA & Plantation Management System</h1>

<p align="center">
  <strong>An offline-first Progressive Web App & Enterprise Platform built for rubber estate operations to measure, validate, and analyze tree girth using Bluetooth digital calipers, background GPS tagging, Supabase cloud sync, automated Google Sheets exports, and TOTP-secured administration.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.1-blue?logo=semver&logoColor=white" alt="v1.3.1" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/PWA-Offline--First-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/IndexedDB-Dexie.js-FF6600?logo=databricks&logoColor=white" alt="Dexie.js" />
  <img src="https://img.shields.io/badge/Backend-Supabase%20%26%20Edge%20Functions-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Export-Google%20Sheets-34A853?logo=googlesheets&logoColor=white" alt="Google Sheets" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?logo=shield&logoColor=white" alt="Proprietary" />
  <img src="https://img.shields.io/badge/By-S%20Plus%20Solutions-0078D4?logo=globe&logoColor=white" alt="S Plus Solutions" />
</p>

---

## 📖 Overview

**GirthTracker** is an enterprise-grade, field-ready Progressive Web Application (PWA) engineered specifically for commercial rubber plantation management. 

Field workers capture tree girth readings using industrial Bluetooth digital calipers (e.g., SYNTEK IP67) that emulate Bluetooth HID keyboards. The application listens globally for measurement signals **hands-free** (requiring no screen focus or manual input), automatically computes tree girth, tags background GPS coordinates, evaluates tapping readiness based on agronomical thresholds, stores data locally in IndexedDB, and seamlessly synchronizes records to a cloud database (Supabase) and estate-specific Google Sheets spreadsheets.

For management and field supervisors, GirthTracker provides a TOTP-secured Admin Dashboard (`/mod`) with device access controls, multi-supervisor Telegram approval bots, field setup QR code generation, interactive Leaflet field maps, abnormal outlier detection, and per-estate sheet export automation.

---

## ⚡ How It Works - End-to-End Automated Pipeline

GirthTracker replaces traditional paper-based tree census routines with a fully automated, error-free digital pipeline:

```
📏 Bluetooth Caliper ──▶ 📱 GirthTracker PWA ──▶ ⚡ Supabase Edge Functions ──▶ 📊 Google Sheets (Estate-wise)
     (Field HID)            (Offline Dexie.js)         (Cloud Database & RLS)          (Per-Estate Sheets)
                                     │
                                     ▼
                            🖥️ Admin Dashboard (`/mod`)
                         (Analytics, QR & Device Control)
```

### Traditional Process vs. GirthTracker

| Step | Old Process | With GirthTracker |
|---|---|---|
| **1. Measurement** | Read caliper screen manually & record on field paper | Bluetooth caliper transmits reading directly to app — **hands-free** |
| **2. Calculation & Tagging** | Calculate girth on paper/mental math; approximate location | App computes `Girth = Reading × π`, tags GPS coordinates & evaluates tapping readiness |
| **3. Local Storage** | Write in register books prone to rain & wear | Saved locally in offline-first IndexedDB (Dexie.js) with instant audio/haptic feedback |
| **4. Cloud Synchronization** | Manual data re-entry into Excel by office clerks | Auto-syncs to Supabase cloud DB & per-estate Google Sheets when online |
| **5. Device & Data Security** | Unverified field log books | Device fingerprinting, access tokens, Telegram supervisor approvals & TOTP Admin |
| **6. Summary & Analytics** | Manual consolidation across divisions & estates | Real-time field insights, Leaflet GPS maps, Z-score abnormal flags & field reports |

---

## ✨ Complete Feature Matrix

### 📏 Field Measurement & Bluetooth Automation
- **Hands-Free Caliper Capture**: Global HID keyboard listener captures caliper readings without focus requirement.
- **Automatic Girth Mathematics**: Auto-computes `Girth (in) = Caliper Reading (in) × π` and converts to `cm` for classification.
- **Auto Tree Increment**: Automatically advances tree sequence number on each successful save.
- **Range & Validity Verification**: Filters noise and rejects readings outside the configurable range (0.5 in – 30.0 in).
- **Sound & Haptic Feedback**: Audible success/warning beeps (toggleable) and vibration pulses confirm measurement capture.
- **Two-Tap Safe Undo**: Prevents accidental deletions with a two-tap confirmation while restoring tree sequence numbers.
- **Tree Counter Adjustment**: Manual `+` / `−` controls for sequence overrides during field obstacles.
- **Manual Entry Fallback**: On-screen fallback keypad in case Bluetooth connectivity is unavailable.
- **Start New Field Wizard**: Switch divisions, fields, or extents mid-session without losing operator context or device authorization.

### 🗺️ GPS Tagging & Interactive Field Maps
- **Background GPS Acquisition**: Periodic GPS location tracking tagged with accuracy (meters) and automated Google Maps links.
- **Interactive Leaflet Field Map**: Embedded map view featuring marker clustering (`react-leaflet-cluster`), re-center controls, GPS accuracy confidence circles, and map legends.
- **Tapping Readiness Visual Coding**: Markers color-coded by readiness:
  - 🟢 **Tappable**: Girth $\ge$ configurable threshold (default: 50 cm)
  - 🟡 **Approaching**: Within margin below threshold (default: 45–49.9 cm)
  - 🔵 **Below Tapping Size**: Girth $< 45\text{ cm}$
  - 🔴 **Abnormal Reading**: Flagged by Z-score outlier engine

### 📊 Analytics, Field Insights & Session Reports
- **In-App Field Insights Modal**: Access distribution histogram, min/max/avg stats, and readiness breakdown via button or URL parameter (`?gt_insights=1`).
- **Abnormal Outlier Engine**: Statistical Z-score outlier detection flags questionable measurements in real-time.
- **Session Report Generator**: Compiles session summary cards with tapping breakdown, sync stats, and share actions (WhatsApp & Web Share API).

### 📴 Offline-First Storage & Hybrid Sync
- **IndexedDB via Dexie.js**: All field measurements persist locally even in complete network blackouts.
- **Background Sync Engine**: Auto-detects network restoration and syncs pending measurements to Supabase cloud storage.
- **Retry & Soft-Delete Management**: Offline queues handle retries for failed payloads and sync soft-delete undo operations.
- **High-Performance RPC Aggregations**: PostgreSQL RPC `get_field_summary_v2()` bypasses 1,000-row REST API limits for large field datasets.

### 🔐 Device Security, Access Control & Telegram Bot
- **Device Fingerprinting**: Captures hardware signatures, user-agent details, and optional GPS coordinates during device registration.
- **Access Approval Gate**: Blocks unauthorized devices until approved by an administrator.
- **Multi-Supervisor Telegram Bot**: Sends instant Telegram notifications to field supervisors with inline **Approve** / **Reject** buttons.
- **Token Management & Revocation**: Revoke device access remotely from the Admin Dashboard.

### 🛠️ TOTP-Secured Admin Dashboard (`/mod`)
- **Secure Authentication**: Password & TOTP authentication with JWT session management.
- **Overview Dashboard**: High-level KPI cards for total measurements, active fields, estate breakdowns, and activity logs.
- **Measurement Data Table**: Multi-filter table view with status badges, search by operator/field, and CSV downloads.
- **Per-Estate Google Sheets Export**: Direct export trigger targeting specific estate spreadsheets with Authorization Bearer verification.
- **QR Code Setup Generator**: Admin tool to generate field setup QR codes (pre-filling Estate, Division, Field No, Extent, Operator).
- **Master Data Management**: Full CRUD interface for Estates, Divisions, and Fields with extent checks (`approval_events` auditing).
- **Device Management**: List, inspect, approve, or revoke field devices.
- **Configuration Manager**: Remote control over estate mappings, Telegram secrets, and feature flags.

### 📱 Installable PWA & Cross-Browser Compatibility
- **Service Worker Caching**: Fully offline cache strategy powered by `vite-plugin-pwa`.
- **Cross-Browser Install Fallbacks**: Custom install UI with platform-specific instructions for iOS Safari, Vivo Browser, Samsung Internet, and Desktop Chrome/Edge.
- **Standalone Mode Detection**: Automatically hides install prompts when running as an installed PWA.

### 🚨 Remote Safety & Maintenance Modes
- **Maintenance Notice Mode**: Configurable banner overlay notifying workers of scheduled maintenance.
- **Disabled Security Mode**: Global kill-switch blocking app access in case of device loss or security incidents.

---

## 📦 Release Notes

### **v1.3.1 - PWA Compatibility & Edge Function Auth Fix**
- **Fixed**: PWA install button display on non-standard Android browsers (Vivo default browser, Samsung Internet) and iOS Safari.
- **Added**: Fallback PWA banner with step-by-step browser installation instructions.
- **Fixed**: Authorization Bearer header inclusion for `export-field` Edge Function calls.
- **Updated**: Google Sheets export workflow to route measurements to designated estate spreadsheets using estate code/name mapping.
- **Optimized**: Split PWA manifest icons into separate `any` and `maskable` entries to satisfy PWA audit standards.

### **v1.3.0 - Admin & Workflow Upgrades**
- **Added**: QR Code Generator in Admin Dashboard for rapid field setup.
- **Added**: Device Management view in Admin Dashboard to inspect and revoke active tokens.
- **Added**: Multi-supervisor Telegram notification support (comma-separated Chat IDs).
- **Added**: URL parameter parsing for automatic field pre-filling upon QR code scanning.

### **v1.2.0 - Field Workflow & Sound System**
- **Added**: Audio feedback toggle (success beep and warning beep for invalid readings).
- **Added**: Start New Field wizard to transition fields mid-session without context loss.
- **Added**: Screen Wake Lock API re-acquisition on visibility changes.

### **v1.1.0 - Supabase Cloud Architecture**
- **Added**: Supabase database integration with PostgreSQL RLS policies.
- **Added**: 10+ Deno Edge Functions for device access, measurement sync, admin auth, and field exports.
- **Added**: RPC function `get_field_summary_v2()` for fast aggregations.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FIELD WORKER LAYER                                     │
│                                                                                        │
│   ┌───────────────────────┐            ┌───────────────────────────────────────────┐   │
│   │  Bluetooth Caliper    │ HID Event  │         GirthTracker PWA (React)          │   │
│   │   (SYNTEK IP67 etc.)  ├───────────►│  • Auto Girth Math     • Range Validator   │   │
│   └───────────────────────┘            │  • GPS Tagging         • Tapping Classifier│   │
│                                        └─────────────────────┬─────────────────────┘   │
│                                                              │                         │
│                                                       ┌──────▼──────┐                  │
│                                                       │  IndexedDB  │ Local            │
│                                                       │ (Dexie.js)  │ Persistence      │
│                                                       └──────┬──────┘                  │
└──────────────────────────────────────────────────────────────┼─────────────────────────┘
                                                               │ Auto-sync when online
┌──────────────────────────────────────────────────────────────▼─────────────────────────┐
│                                   SUPABASE CLOUD LAYER                                 │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              Supabase Edge Functions                           │   │
│   │  • check-access   • request-access   • sync-measurements   • undo-measurement  │   │
│   │  • approve-device • admin-auth       • admin-fetch         • export-field      │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                                   ┌──────▼──────┐                                      │
│                                   │ PostgreSQL  │ Row Level Security                   │
│                                   │ Database    │ & Audit Triggers                     │
│                                   └──────┬──────┘                                      │
└──────────────────────────────────────────┼─────────────────────────────────────────────┘
                                           │ Export Edge Function
┌──────────────────────────────────────────▼─────────────────────────────────────────────┐
│                                  EXTERNAL INTEGRATIONS                                 │
│                                                                                        │
│   ┌───────────────────────────────┐           ┌────────────────────────────────────┐   │
│   │      Google Apps Script       │           │        Telegram Supervisor Bot     │   │
│   │  (Web App per-estate export)  │           │   (Device Approval Alerts & Inline)│   │
│   └──────────────┬────────────────┘           └────────────────────────────────────┘   │
│                  │                                                                     │
│           ┌──────▼───────┐                                                             │
│           │ Google Sheet │ (Per-Estate Spreadsheets)                                   │
│           └──────────────┘                                                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| **UI Framework** | [React](https://react.dev/) | 19.x | Declarative component interface |
| **Build System** | [Vite](https://vitejs.dev/) | 8.x | Lightning-fast development & production bundling |
| **PWA Caching** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | 1.x | Service worker compilation & manifest handling |
| **Local Database** | [Dexie.js](https://dexie.org/) | 4.x | Offline IndexedDB wrapper with reactive hooks |
| **Cloud Backend** | [Supabase](https://supabase.com/) | 2.x | PostgreSQL DB, Auth, Edge Functions & RLS |
| **Mapping Engine** | [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/) | 1.9 / 5.0 | Interactive field map & marker clustering |
| **Icons & Styling** | [Lucide React](https://lucide.dev/) & Vanilla CSS | 1.x | Modern UI iconography & CSS custom variables |
| **Legacy Export** | [Google Apps Script](https://developers.google.com/apps-script) | - | Google Sheets spreadsheet integration |
| **Testing** | [Vitest](https://vitest.dev/) | 4.x | Unit testing suite for utilities & logic |
| **Linting** | [ESLint](https://eslint.org/) | 10.x | Code style & quality enforcement |

---

## 📁 Project Structure

```
S-Plus-GirthTracker/
├── public/
│   ├── logo.png                       # Primary app logo & favicon
│   ├── pwa-192x192.png                # PWA icon (192x192)
│   ├── pwa-512x512.png                # PWA icon (512x512 maskable)
│   └── screenshot.png                 # PWA install preview screenshot
├── src/
│   ├── assets/                        # Static graphical assets
│   ├── components/
│   │   ├── AccessGate.jsx             # Device access approval gate
│   │   ├── AdminConfigTab.jsx         # Admin system & mapping settings
│   │   ├── AdminPage.jsx              # TOTP-secured Admin Dashboard
│   │   ├── FieldInsightsModal.jsx     # Analytical distribution modal
│   │   ├── FieldMap.jsx               # Collapsible GPS map container
│   │   ├── MeasurementMap.jsx         # Leaflet map with clustering & markers
│   │   ├── SessionReport.jsx          # Field session summary generator
│   │   └── SetPassword.jsx            # Password configuration for invited admins
│   ├── services/
│   │   ├── accessControl.js           # Device ID, registration & tokens
│   │   ├── analytics.js               # Z-score abnormal detection
│   │   ├── location.js                # Background GPS tracking service
│   │   ├── recommendation.js          # Tapping readiness classifier
│   │   ├── reports.js                 # Session report compilation & sharing
│   │   ├── supabaseClient.js          # Supabase client initializer
│   │   └── supabaseSync.js            # Sync & admin API fetch wrappers
│   ├── App.jsx                        # Main tracker application & routing
│   ├── db.js                          # Dexie IndexedDB database schema
│   ├── index.css                      # Global design system & theme tokens
│   ├── main.jsx                       # React root entry point
│   ├── treeCondition.test.js          # Unit tests for tree readiness
│   ├── utils.js                       # Caliper parsing & girth math utilities
│   └── utils.test.js                  # Unit tests for core utilities
├── supabase/
│   ├── functions/                     # Supabase Deno Edge Functions
│   │   ├── _shared/                   # Shared CORS & helper utilities
│   │   ├── admin-auth/                # Admin login & JWT verification
│   │   ├── admin-config/              # Estate, script & config management
│   │   ├── admin-fetch/               # Measurement & device data querying
│   │   ├── approve-device/            # Device approval & revocation
│   │   ├── check-access/              # Device authorization validation
│   │   ├── export-field/              # Google Sheets export worker
│   │   ├── fetch-config/              # Public runtime configuration endpoint
│   │   ├── request-access/            # Device registration & Telegram alert
│   │   ├── sync-measurements/         # Batch measurement sync engine
│   │   └── undo-measurement/          # Measurement undo handler
│   ├── schema.sql                     # Complete PostgreSQL schema (RLS, tables, triggers)
│   ├── schema_updates_v2.sql          # DB Migration v2
│   ├── schema_updates_v3.sql          # DB Migration v3
│   ├── schema_updates_v4.sql          # DB Migration v4
│   ├── schema_updates_v5.sql          # DB Migration v5
│   └── schema_updates_v6.sql          # RPC get_field_summary_v2 aggregation
├── docs/                              # Architecture & buyer guides
├── .env.example                       # Environment variable template
├── google-apps-script.txt             # Google Apps Script deployment code
├── index.html                         # Single-page HTML document
├── package.json                       # Dependencies & script definitions
├── vite.config.js                     # Vite build & PWA manifest setup
└── eslint.config.js                   # ESLint flat configuration
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **v18.0.0 or higher**
- [npm](https://www.npmjs.com/) **v9.0.0 or higher**
- A [Supabase](https://supabase.com/) project (for cloud database and Edge Functions)
- A Google Account (for optional Google Sheets per-estate sync)
- A Bluetooth digital caliper supporting HID keyboard emulation *(optional for testing)*

### Installation & Local Setup

```bash
# 1. Clone or extract the repository
cd S-Plus-GirthTracker

# 2. Install project dependencies
npm install

# 3. Create your environment configuration file
cp .env.example .env

# 4. Update .env with your Supabase URL and Anon Key (see Environment Variables section)

# 5. Start the Vite development server
npm run dev
```

### Available NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch Vite hot-reloading development server |
| `npm run build` | Compile production bundle to `dist/` with PWA service worker |
| `npm run preview` | Serve production build locally for verification |
| `npm run lint` | Execute ESLint to check for syntax and style issues |
| `npm run test` | Run Vitest unit tests for utilities and business logic |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root based on `.env.example`:

### Public Browser Variables (`VITE_*`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | - | Supabase project URL (`https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | - | Supabase public anonymous API key |
| `VITE_GAS_URL` | ❌ | - | Optional direct Google Apps Script Web App URL |
| `VITE_REQUIRE_ACCESS_APPROVAL` | ❌ | `"true"` | Require device authorization gate before app use |
| `VITE_REQUIRE_GPS_FOR_APPROVAL` | ❌ | `"false"` | Require GPS location during device access request |
| `VITE_ENABLE_GPS_TAGGING` | ❌ | `"true"` | Tag measurements with GPS coordinates |
| `VITE_GPS_REFRESH_INTERVAL_SECONDS` | ❌ | `180` | GPS background refresh interval in seconds |
| `VITE_ENABLE_SESSION_REPORTS` | ❌ | `"true"` | Enable field session summary report modal |
| `VITE_SHOW_FIELD_INSIGHTS_BUTTON` | ❌ | `"false"` | Display Insights button on home UI (always accessible via `?gt_insights=1`) |
| `VITE_ENABLE_ABNORMAL_ALERTS` | ❌ | `"true"` | Enable Z-score statistical outlier detection |
| `VITE_ABNORMAL_Z_SCORE` | ❌ | `2` | Sensitivity Z-score threshold for abnormal alerts |
| `VITE_ENABLE_TAPPING_RECOMMENDATION` | ❌ | `"true"` | Enable tapping readiness classification |
| `VITE_TAPPABLE_GIRTH_CM` | ❌ | `50` | Girth threshold (cm) for tappable classification |
| `VITE_APPROACHING_MARGIN_CM` | ❌ | `5` | Margin (cm) below threshold for "approaching" status |
| `VITE_MAINTENANCE_MODE` | ❌ | `"false"` | Toggle global maintenance notice screen |
| `VITE_DISABLED_MODE` | ❌ | `"false"` | Toggle access disabled security screen |
| `VITE_APP_VERSION` | ❌ | `"1.3.1"` | Version string displayed in footer and reports |

### Supabase Edge Function Secrets

Set these secrets directly in Supabase Dashboard (**Settings → Edge Functions → Secrets**) or using Supabase CLI:

```bash
supabase secrets set GAS_URL="https://script.google.com/macros/s/.../exec"
supabase secrets set GAS_SHARED_SECRET="your_shared_secret"
supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC..."
supabase secrets set TELEGRAM_CHAT_ID="-100123456789,987654321"
supabase secrets set ADMIN_TOTP_SECRET="your_totp_secret"
```

---

## 🗄️ Backend Setup Guide

### 1. Supabase Database & Edge Functions Setup

1. Open your Supabase Dashboard and navigate to the **SQL Editor**.
2. Run the SQL contained in [`supabase/schema.sql`](supabase/schema.sql).
3. Sequentially run migration scripts (`schema_updates_v2.sql` through `schema_updates_v6.sql`).
4. Deploy the Edge Functions located in `supabase/functions/`:
   ```bash
   supabase functions deploy admin-auth
   supabase functions deploy admin-config
   supabase functions deploy admin-fetch
   supabase functions deploy approve-device
   supabase functions deploy check-access
   supabase functions deploy export-field
   supabase functions deploy fetch-config
   supabase functions deploy request-access
   supabase functions deploy sync-measurements
   supabase functions deploy undo-measurement
   ```

### 2. Google Apps Script & Google Sheets Export Setup

1. Create a Google Spreadsheet for each estate.
2. Open **Extensions → Apps Script**.
3. Copy the contents of [`google-apps-script.txt`](google-apps-script.txt) into `Code.gs`.
4. Configure your `ESTATE_SHEET_MAP` in the script:
   ```javascript
   const ESTATE_SHEET_MAP = {
     "Estate A": "GOOGLE_SHEET_ID_FOR_ESTATE_A",
     "Estate B": "GOOGLE_SHEET_ID_FOR_ESTATE_B"
   };
   ```
5. Set `SHARED_SECRET` in Apps Script to match your Edge Function secret `GAS_SHARED_SECRET`.
6. Click **Deploy → New deployment** as a **Web app** (`Execute as: Me`, `Who has access: Anyone`).
7. Copy the deployed Web App URL and add it to your Supabase Edge Function secrets.

---

## 🔐 Admin Dashboard & Authorization Workflow

### Accessing the Admin Dashboard

- Navigate to `/mod` in your browser (e.g., `https://your-domain.com/mod`).
- Log in using your configured Admin credentials.
- New admin users invited by system administrators can set their password via `/complete-invite`.

### Key Admin Workflows

1. **Device Approvals**:
   - When a new device opens GirthTracker, an access request is logged.
   - Supervisors receive an automated Telegram alert with **Approve** / **Reject** buttons or can approve devices directly inside `/mod` under **Device Management**.
2. **Generating Field Setup QR Codes**:
   - Go to **QR Setup** tab in Admin Dashboard.
   - Select Estate, Division, Field, Extent, and Operator Name.
   - Print or share the generated QR code. Field workers scan it to pre-fill their entire app setup instantly.
3. **Per-Estate Data Exports**:
   - Go to **Measurements** tab in Admin Dashboard.
   - Filter by Estate/Division/Field.
   - Trigger **Export to Sheet** to push data to the configured Google Sheet via the authenticated Edge Function.

---

## 📱 Field Worker User Guide

### 1. Setup & Starting a Field
- Scan the field **QR code** provided by your supervisor, or manually enter Estate, Division, Field No, Extent, and Operator Name.
- Tap **Save & Start Measuring**.

### 2. Measuring Trees with Bluetooth Caliper
- Ensure Bluetooth caliper is paired with your mobile device.
- Place caliper jaw on the tree and press the caliper's **Data Send** button.
- The app automatically:
  1. Captures the Bluetooth HID signal.
  2. Calculates tree girth in inches & centimeters.
  3. Evaluates tapping readiness (Tappable / Approaching / Below).
  4. Saves record to offline database.
  5. Plays success sound and vibrates.
  6. Increments tree counter for the next measurement.

### 3. Using Field Maps & Session Reports
- Tap **Field Map** to view all recorded trees on an interactive GPS map.
- Tap **Session Report** at any time to generate a summary card and share it with field supervisors via WhatsApp.

---

## 🚢 Production Deployment

### Deploying to Vercel (Recommended)

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Configure the environment variables in **Vercel Project Settings → Environment Variables**.
4. Vercel auto-detects Vite and deploys your PWA.

---

## 📄 License & Intellectual Property

© 2026 **[S Plus Solutions](https://www.splussolutions.com)**. All rights reserved.

This software is **proprietary and confidential**. Unauthorized copying, distribution, modification, reverse engineering, or public display of this software, via any medium, is strictly prohibited without prior explicit written authorization from S Plus Solutions.

---

<p align="center">
  Built with ❤️ by <a href="https://www.splussolutions.com"><strong>S Plus Solutions</strong></a> for global rubber plantation management.
</p>
