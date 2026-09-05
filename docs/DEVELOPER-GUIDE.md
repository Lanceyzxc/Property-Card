# UCN ProCard System Developer Guide

This guide is for developers who maintain, run, deploy, or extend the project.

## Overview

The project is a static browser application served by a small Node.js HTTP server. There is no application API in this repository. Browser JavaScript communicates directly with Firebase Firestore.

The main data collection is:

```text
propertyTags/{cardId}
```

The Property Cards and Inventory Tags pages use this same collection.

## Project Structure

```text
Property Card/
├── package.json                 Node scripts
├── server.js                    Local static web server
├── firebase.json                Firebase Hosting configuration
├── .firebaserc                  Firebase project selection
├── README.md                    Documentation index
├── docs/
│   ├── USER-GUIDE.md            Non-technical user documentation
│   └── DEVELOPER-GUIDE.md       This document
└── public/
    ├── index.html               Property Cards page
    ├── inventory.html           Inventory Tags page
    ├── par.html                 Property Acknowledgment Receipt template
    ├── ics.html                 Inventory Custodian Slip template
    ├── 404.html                 Firebase Hosting not-found page
    └── assets/
        ├── css/
        │   ├── styles.css       Property Cards styles
        │   └── inventory.css    Inventory Tags styles
        ├── images/               Logos and image assets
        └── js/
            ├── main.js          Card state, import, editing, filtering, and saving
            ├── inventory.js     Inventory rendering, editing, numbering, and printing
            └── print.js         Property card print layout
```

## Local Development

### Requirements

- Node.js.
- Internet access for Firebase and external browser libraries loaded from CDNs.

There are currently no npm package dependencies.

### Start the server

From the project folder:

```powershell
npm start
```

The default port is `3000`. If that port is busy, `server.js` tries the next few ports automatically.

Open the URL printed in the terminal. The server serves files from `public/` and maps `/` to `public/index.html`.

### Check JavaScript syntax

```powershell
node --check "public/assets/js/main.js"
node --check "public/assets/js/inventory.js"
node --check "public/assets/js/print.js"
```

## Client-Side Responsibilities

### `main.js`

Owns the Property Cards page, including:

- Department definitions and card colors.
- Loading records from Firestore.
- Creating blank cards.
- Importing Excel or CSV data.
- Card editing and auto-save.
- Search, department filtering, pagination, and selection.
- Card deletion.
- QR code generation.
- Links to PAR and ICS forms.

Excel import starts at row 5 of the first worksheet. It imports rows whose `Inventory/Property Classification` contains `semi` or `non`, which is why Expendable records are skipped.

### `inventory.js`

Owns the Inventory Tags page, including:

- Loading `propertyTags` records.
- Search and department filtering.
- Inline contenteditable fields.
- Automatic inventory number assignment.
- Live Firestore updates.
- Lazy QR code rendering.
- Visible and selected inventory printing.

Missing inventory numbers are assigned using the current two-digit year and a four-digit sequence, such as `26-0001`. Writes are batched below Firestore's 500-write batch limit.

### `print.js`

Builds a temporary print-only sheet for property cards, groups ten cards per print page, copies card data and QR images, opens `window.print()`, and removes the temporary sheet afterward.

Inventory printing is implemented in `inventory.js` and also batches ten tags per print page.

### `par.html` and `ics.html`

These are printable document templates. The form selected for a QR link is based on the property number:

- Values containing `SPLV` or `SPHV` use `ics.html`.
- Other values use `par.html`.

## Firestore Data Model

Common fields in `propertyTags/{cardId}` include:

```text
cardId
dept
color
quantity
unit
icsParNo
propertyNo
serialNo
serviceable
unserviceable
dateCounted
dateAcquired
acquisitionCost
fund
endUserLocation
requestedBy
supplier
reference
itemDescription
inventoryTag
coaRepresentative
propertyCustodian
qrUrl
savedAt
```

When adding a field, update every relevant boundary:

1. Card data collection and persistence in `main.js`.
2. Card rendering and editing in `index.html`/`main.js`.
3. Inventory rendering and editing in `inventory.js`, if the field belongs on tags.
4. Property card and inventory print layouts.
5. QR or form population if the field is part of a linked form.
6. Documentation and test coverage.

## Firebase Configuration

The Firebase browser configuration is currently duplicated in:

- `public/assets/js/main.js`
- `public/assets/js/inventory.js`

If the Firebase project changes, update both files consistently. Verify Firestore security rules separately; this repository does not contain those rules.

Hosting configuration:

- `firebase.json` serves the `public/` directory.
- `.firebaserc` selects the Firebase project `ucn-property-tag-b7e0a`.

## Deployment

A typical Firebase Hosting deployment is:

```powershell
firebase login
firebase use ucn-property-tag-b7e0a
firebase deploy --only hosting
```

Before deployment, verify the selected Firebase project, public URL, Firestore rules, and the intended version of the browser scripts. This application writes live operational records.

## External Browser Libraries

The HTML pages load these libraries from CDNs:

- SheetJS (`xlsx`) for Excel and CSV parsing.
- Firebase App and Firestore compatibility SDKs.
- QRCode.js for QR generation.

A browser without network access may fail to import files, load records, or render QR codes.

## Troubleshooting For Developers

### Firestore records do not load

Check browser console errors, network access, Firebase initialization, project ID, and Firestore read permissions.

### Changes do not save

Property cards save after debounced input/change events. Inventory tags save on blur. Check the document ID, field name, Firestore update call, and write permissions.

### QR codes point to the wrong environment

The code falls back to the published application URL when running on localhost. Review `getPublicBaseUrl()` and the generated `qrUrl` before testing QR codes from a local server.

### Import produces no cards

Verify that the first worksheet has headings on row 5 and that the classification value contains `semi` or `non`. Header matching removes spaces and ignores case, but it does not infer arbitrary column meanings.

### Print layout is misaligned

Check browser print settings first. Then inspect the print CSS and the ten-card page batching in `print.js` or `inventory.js`. Keep card dimensions and grid gaps synchronized with the print styles.

## Operational Risks And Maintenance Notes

- Firestore is the source of truth for saved records.
- The repository does not provide a backup or export workflow.
- Firebase configuration appears in browser code; protect the project through proper Firestore security rules and Firebase project access controls.
- Test imports with a copy of production spreadsheets.
- Confirm print output before large print runs.
- Keep the user guide updated when visible workflows or button names change.
