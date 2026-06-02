# Seller Packaging Checklist — GirthTracker

Use this checklist before uploading the product ZIP to Gumroad or another digital marketplace.

---

## 1. Clean the Repository

Before packaging, make sure the ZIP does not include private or unnecessary files.

Do not include:

- `.env`
- Real Google Apps Script URLs
- Real Google Sheet IDs unless they are examples only
- Real shared secrets
- `node_modules/`
- `dist/` unless you intentionally want to include a prebuilt demo
- `.git/`
- Personal screenshots with private business data
- Customer data
- Browser debug screenshots

Safe to include:

- `.env.example`
- `google-apps-script.txt` with placeholders
- `src/`
- `public/`
- `docs/`
- `README.md`
- `package.json`
- `package-lock.json` if present
- `vite.config.js`
- `eslint.config.js`
- `index.html`

---

## 2. Replace Private Values With Placeholders

Check these files carefully:

### `.env.example`

Should contain only placeholders:

```env
VITE_GAS_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
VITE_ESTATES="Sample Estate,North Estate,South Estate"
VITE_GAS_SECRET="your_shared_secret_here"
VITE_MAINTENANCE_MODE="false"
VITE_DISABLED_MODE="false"
```

### `google-apps-script.txt`

Should contain placeholders:

```javascript
const SHARED_SECRET = "CHANGE_ME_TO_A_RANDOM_STRING";

const ESTATE_SHEET_MAP = {
  "Your Estate Name": "YOUR_GOOGLE_SHEET_ID_HERE"
};
```

---

## 3. Test the Clean Package

Before uploading to Gumroad:

1. Copy the project to a temporary folder.
2. Delete `.git`, `.env`, `node_modules`, and any private files.
3. Run:

```bash
npm install
npm run build
```

4. Confirm the production build succeeds.
5. Run:

```bash
npm run preview
```

6. Confirm the app opens.
7. Confirm documentation links are correct.

---

## 4. Suggested ZIP File Name

Use a clear versioned filename:

```text
girthtracker-react-pwa-source-v1.0.0.zip
```

For updates:

```text
girthtracker-react-pwa-source-v1.1.0.zip
```

---

## 5. Suggested Gumroad File Bundle

Upload one ZIP containing:

```text
girthtracker-react-pwa-source-v1.0.0.zip
```

Optional extra files:

```text
quick-start.pdf
license.pdf
```

You can create those later from the Markdown docs if needed.

---

## 6. Screenshots to Prepare

Recommended Gumroad gallery images:

1. Product cover image
2. Setup screen
3. Main measurement screen
4. Pending/synced status counters
5. Recent measurements list
6. Google Sheets output example
7. Architecture diagram
8. Feature list graphic

Do not show real estate/customer data.

---

## 7. Suggested Demo Video Script

Length: 60–90 seconds.

Suggested structure:

1. Show title: `GirthTracker — Offline Rubber Tree Girth Tracker PWA`
2. Explain the problem: field workers need fast tree measurements even without internet.
3. Show setup screen.
4. Show manual test measurement.
5. Show auto tree increment.
6. Show offline/pending state.
7. Show sync to Google Sheets.
8. Show CSV export.
9. End with: `React + PWA + IndexedDB + Google Sheets`

---

## 8. Gumroad Pricing Setup

Recommended setup:

- Launch price: **$49**
- Regular price: **$79**
- Extended Client License: **$149**

Suggested discount strategy:

- First 10 buyers: $49
- After first 10 buyers: $79
- Custom setup service: $299+

---

## 9. Product Page Checklist

Before publishing, confirm Gumroad page includes:

- [ ] Clear title
- [ ] Strong subtitle
- [ ] Screenshots
- [ ] Feature list
- [ ] Tech stack
- [ ] Buyer requirements
- [ ] License terms
- [ ] Refund policy
- [ ] Support boundary
- [ ] ZIP file uploaded
- [ ] Correct price
- [ ] Product tags/keywords
- [ ] Contact email or support instructions

---

## 10. After Publishing

After the product is live:

- Test purchase flow with a discount code.
- Download the uploaded ZIP and verify contents.
- Confirm files extract correctly.
- Keep a local copy of the exact uploaded version.
- Create a changelog for future updates.

---

## 11. Versioning Recommendation

Use semantic versioning:

```text
v1.0.0 — initial Gumroad release
v1.0.1 — documentation/fix update
v1.1.0 — small new feature
v2.0.0 — major redesign or architecture change
```

Keep a short changelog so buyers know what changed.
