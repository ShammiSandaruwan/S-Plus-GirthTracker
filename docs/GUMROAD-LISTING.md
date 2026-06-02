# Gumroad Listing Copy - GirthTracker

Use this page as the master copy for creating the Gumroad product listing.

---

## Recommended Product Title

**GirthTracker - Offline Rubber Tree Girth Measurement PWA Source Code**

## Short Subtitle

A field-ready React PWA for rubber estate workers to capture Bluetooth caliper readings offline and sync them to Google Sheets.

## One-Line Hook

Turn a Bluetooth digital caliper and a mobile phone into an offline-first rubber tree girth data collection system.

---

## Short Description

**GirthTracker** is a complete React + Vite Progressive Web App built for rubber estate field measurement workflows. It captures Bluetooth HID caliper readings, calculates tree girth automatically, saves measurements offline in IndexedDB, and syncs records to Google Sheets when internet is available.

Perfect for developers, estate technology teams, agriculture software builders, and consultants who need a ready-made field data collection foundation.

---

## Long Product Description

GirthTracker is a production-style source code package for building a mobile-friendly rubber tree girth measurement app.

The app is designed for estate field workers who use industrial Bluetooth digital calipers that send readings as keyboard/HID input. Once the caliper is paired with the phone or tablet, the worker can press the caliper's data-send button and the app automatically captures the reading, validates it, calculates girth using `caliper reading × π`, saves the result locally, increments the tree number, and prepares for the next tree.

Because estate field work often happens in weak-signal areas, GirthTracker is built offline-first. Measurements are stored locally using Dexie.js/IndexedDB and automatically synced to Google Sheets through a Google Apps Script web endpoint once connectivity returns.

This is not a generic CRUD starter template. It is a focused, industry-specific field data collection app with PWA installation, Bluetooth HID workflow, local persistence, Google Sheets integration, CSV export, undo, manual entry fallback, status counters, shared-secret endpoint protection, maintenance mode, and field-friendly UI.

---

## Key Features

- Offline-first PWA with installable mobile experience
- Bluetooth HID caliper input support
- Automatic girth calculation using `reading × π`
- Auto-incrementing tree numbers
- Estate, division, field number, and extent setup workflow
- Local data storage with Dexie.js and IndexedDB
- Google Sheets sync through Google Apps Script
- Per-estate sheet routing
- Shared-secret protection for the sync endpoint
- Pending, synced, and failed status handling
- Manual measurement entry fallback
- CSV export
- Two-tap undo protection
- Screen wake lock for field use
- Maintenance and disabled access modes
- High-contrast responsive UI optimized for outdoor use

---

## What's Included

- Full React + Vite source code
- PWA configuration and manifest
- Dexie.js database schema
- Google Apps Script backend template
- Environment variable template
- Buyer setup guide
- Support policy
- Buyer license template
- Seller packaging checklist
- Gumroad listing copy

---

## Tech Stack

- React 19
- Vite 8
- vite-plugin-pwa
- Dexie.js / IndexedDB
- Google Apps Script
- Google Sheets
- Vanilla CSS
- Lucide React icons

---

## Ideal Buyers

- Developers building agriculture or plantation data apps
- Rubber estate IT teams
- Agri-tech consultants
- Freelancers serving estate clients
- Students or researchers building field data collection tools
- Businesses needing an offline-first PWA starter for hardware-assisted measurement workflows

---

## Buyer Requirements

- Basic JavaScript/React knowledge
- Node.js and npm installed
- A Google account for Google Sheets sync
- A hosting provider such as Vercel, Netlify, or any static web host
- Optional: Bluetooth digital caliper that sends readings using HID/keyboard mode

---

## Suggested Gumroad Pricing

### Best Simple Price

Set the main product price to:

**USD $79**

This positions the app as a premium niche source-code product, not a cheap generic template.

### Launch Discount

For the first 10-20 sales, use:

**USD $49 launch price**

Then raise to:

**USD $79 regular price**

### Optional Pricing Tiers

If using Gumroad variants or separate products:

| Tier | Price | Usage |
|---|---:|---|
| Starter Source License | $49 | Individual learning, testing, one internal project |
| Commercial License | $79 | One commercial deployment for own business |
| Extended Client License | $149-$199 | Use for one paid client project |
| Done-With-You Setup Add-on | $299+ | You help configure Google Sheets, deploy, and customize branding |

Recommended first setup:

- Launch price: **$49**
- Regular price after launch: **$79**
- Optional extended client-use license: **$149**

---

## Suggested Tags / Keywords

Use these where Gumroad allows tags or search keywords:

`react`, `vite`, `pwa`, `offline app`, `indexeddb`, `dexie`, `google sheets`, `google apps script`, `agritech`, `field data`, `rubber estate`, `plantation`, `bluetooth caliper`, `source code`, `javascript`, `mobile web app`

---

## Thumbnail / Cover Text Ideas

Use one of these short cover headlines:

1. **Offline Rubber Tree Girth Tracker**
2. **Bluetooth Caliper + Google Sheets PWA**
3. **Field Data App Source Code**
4. **React PWA for Plantation Measurements**

Recommended cover layout:

- Dark green / black premium tech-agriculture theme
- Phone mockup showing current tree number and sync status
- Small Google Sheets icon or spreadsheet graphic
- Bluetooth caliper icon or device silhouette
- Short badge: `React + PWA + Google Sheets`

---

## Gumroad Product FAQ

### Is this a finished app or a starter template?

It is a complete source-code application that can be configured and deployed. Buyers may still need to customize estate names, Google Sheet IDs, branding, and deployment settings.

### Does it require a real Bluetooth caliper?

No for development/testing. You can use the manual entry field or simulate caliper input with keyboard numbers followed by Enter. For real field use, a Bluetooth HID/keyboard-mode caliper is recommended.

### Does it use Web Bluetooth?

No. It is designed for calipers that behave like Bluetooth keyboards. This is simpler and more compatible on many mobile devices.

### Does it work offline?

Yes. Measurements are saved locally in IndexedDB and synced later when internet is available.

### Where does the data go?

Data is synced to Google Sheets using a Google Apps Script web app endpoint.

### Can buyers resell this source code?

No. The buyer license should allow modification and deployment but should not allow reselling, redistributing, or publishing the source code as a competing template/product.

### Do you provide customization?

Optional paid customization can be offered separately. Suggested starting price: **$299+** for deployment/setup help and **$500+** for custom features.

---

## Refund Policy Text

Because this is a digital source-code product, refunds are not offered after download except for duplicate purchases or file-access issues. Buyers should read the product description, requirements, and license terms before purchasing.

---

## Support Text

Purchase includes documentation and basic setup guidance. Custom development, Google account troubleshooting, hardware compatibility testing, deployment for your business, and new feature requests are not included unless purchased separately.
