# UCN ProCard System User Guide

This guide is for office staff and anyone who uses the application to create, review, and print property records.

## Quick Reference

| Task | Where to go |
|---|---|
| Sign in | Login page; select your department and enter the administrator-provided password |
| Upload an Excel list | Property Cards page |
| Create a blank property card | Property Cards page, **Add New Cards** |
| Find a saved record | Property Cards search or department filter |
| View or restore archived cards | **Archived Cards** page |
| Print property tags | Property Cards page, **Print Tags** |
| View inventory labels | **Inventory Tags** page |
| Print selected inventory labels | Inventory Tags page, select tags, then **Print Selected** |
| Open a linked form | Scan the QR code on a property card or inventory tag |

## Before You Start

Prepare the following:

- A supported browser such as Chrome, Edge, or Firefox.
- Internet access.
- An approved Excel or CSV file when importing records.
- The correct department and property information for review.

You must sign in with your department before using the Property Cards or Inventory Tags pages. The `MAIN` department can work across all departments. Other departments are automatically limited to their own records.

Do not upload a spreadsheet until it has been checked. Imported records can become live saved records in the system.

## What This Application Does

The UCN ProCard System helps the Supply and Property Management Office:

- Create property cards from an Excel file.
- Add or correct card information.
- Search and filter property records.
- Create and print property tags.
- View and print inventory tags.
- Open PAR or ICS forms through QR codes.

Saved records are shared between the Property Cards and Inventory Tags pages.

## Opening The Application

Open the published application in a browser. The first page is the **Login** page.

To sign in:

1. Select your department.
2. Enter the password provided by the system administrator.
3. Optionally enable **Remember me**.
4. Click **SIGN IN**.

When **Remember me** is enabled, the selected department is prefilled on a later visit. Without it, access is kept only for the current browser session. Use **Forgot password?** to contact the system administrator; password recovery is managed outside the application.

The application needs an internet connection because it uses online storage and browser libraries.

After sign-in, a short loading screen appears while the workspace and saved records are prepared.

## Loading Cards From Excel

1. Open the **Property Cards** page.
2. Select an Excel file under **Upload Excel File**.
3. Click **Load Data**.
4. Review the cards that were created.
5. Fill in or correct missing information directly on the cards.

The file may be `.xlsx`, `.xls`, or `.csv`.

### Excel file requirements

- The first worksheet is used.
- Column headings must be on row 5.
- Only records marked **Semi-Expendable** or **Non-Expendable** are imported.
- Expendable items are skipped automatically.

The importer recognizes common headings such as:

| Information | Accepted examples |
|---|---|
| Department | `Department` |
| Classification | `Inventory/Property Classification` |
| Description | `Item Description`, `Description`, `Article`, `Item Name` |
| Property number | `Property No.`, `Item No.`, `Asset No.` |
| Quantity | `Quantity`, `Qty`, `No. of Units` |
| Unit | `Unit`, `Unit of Measure`, `UOM` |
| Date acquired | `Date Acquired`, `Date Delivered`, `Acquired Date` |
| Cost | `Acquisition Cost`, `Unit Cost`, `Cost`, `Amount` |
| Reference | `P.O/J.O/Contract Ref`, `Reference No.`, `Contract Reference` |
| PAR or ICS number | `PAR No.`, `ICS No.`, `ICS/PAR No.` |
| Other details | `Serial No.`, `Fund`, `Location`, `Requested By`, `Supplier`, `Date Counted` |

Capitalization and spaces do not matter, but the heading still needs to describe the correct information.

### After importing

Review the generated cards before printing or closing the browser:

1. Confirm the number of generated cards.
2. Check the department color and department name.
3. Check the property number, description, quantity, and acquisition cost.
4. Complete missing information.
5. Wait briefly after editing so changes can be saved.
6. Refresh or search for a record to confirm the saved information.

If a property number contains a range such as `ABC-001 to ABC-005`, the system may create a separate card for each number in the range.

## Working With Property Cards

### Edit a card

Click or type into a card field to add or correct information. Changes are saved automatically after a short delay.

Each card has a QR code. The code opens the record's form when scanned.

Common card fields include:

| Field | Meaning |
|---|---|
| ICS/PAR No. | Official acknowledgment or custody document number |
| Property No. | Unique property or asset number |
| Date Acquired | Date the item was acquired or delivered |
| Acquisition Cost | Recorded cost or amount of the item |
| Fund | Fund or fund cluster used for the purchase |
| End-User/Location | Person, office, or location responsible for the item |
| Requested By | Person who requested or will use the item |
| Supplier | Supplier or vendor |
| P.O/J.O/Contract Ref | Purchase order, job order, or contract reference |
| Item Description | Description of the property |

Save behavior:

- Property card fields save automatically after typing or changing a value.
- A short delay is normal while the save is processed.
- A QR code may update after the record is saved.
- If the browser is offline, the change may not reach the shared records.

### Filter and search

Use the left-side controls to:

- Filter cards by department when signed in as `MAIN`.
- Search for card information.
- Reset the filter and search.
- Move between pages of cards.
- Change field text between enhanced and plain colors.

The dashboard shows the total number of cards and the number currently visible.

For a department other than `MAIN`, the department filter is hidden and all displayed cards are automatically limited to the signed-in department. Imported rows from other departments are skipped.

### Add blank cards

Use **Add New Cards** to choose a department and create one or more blank cards.

### Select, print, or archive cards

Open **Batch Actions** to select cards.

- **Select All** selects every card.
- **Select Visible** selects cards currently shown by the filter.
- **Clear Selection** removes the selection.
- **Print Selected** prints only selected cards.
- **Archive Selected** moves selected cards out of the active list while keeping their QR codes working.
- Open **Archived Cards** to restore records or permanently delete them. Permanent deletion stops the associated QR code from loading the card details.
- **Print Tags** prints all available cards.

Always check the browser print preview before printing a full batch.

### Recommended print checks

Before confirming the print job, verify:

- The correct cards are included.
- The property numbers and descriptions are readable.
- QR codes are visible.
- The paper size and orientation match the office form or label stock.
- Browser scale and margins do not shrink or cut off the cards.

The property card print layout is designed to place up to ten cards on a print page.

## Working With Inventory Tags

1. Open **Inventory Tags** from the Property Cards page.
2. Search by property number, article, serial number, department, or location.
3. If signed in as `MAIN`, choose a department if needed. Other departments are automatically limited to their own tags.
4. Edit text directly on a tag.
5. Click outside an edited field so the change can be saved.
6. Print all visible tags or select specific tags and print them.

Missing inventory numbers are assigned automatically in the format `YY-NNN`, for example `26-001`.

### Inventory tag fields

| Field | Meaning |
|---|---|
| Inventory Tag No. | System-assigned inventory label number |
| Office/Location | Department or location where the item is kept |
| Description | Name or description of the item |
| Property No. | Property record number |
| Acquisition Cost | Recorded purchase or acquisition cost |
| Date Acquired | Date the item was acquired |
| Person Accountable | Person responsible for the item |
| Date Counted | Date the item was physically counted |
| Inventory Committee | Committee or representative information |
| Property Custodian | Property custodian information |

Inventory tag edits are saved when you click outside the edited field. Allow a moment for the update before refreshing the page.

## QR Codes And Forms

The form depends on the property number:

- A property number containing `SPLV` or `SPHV` opens an **Inventory Custodian Slip (ICS)**.
- Other property numbers open a **Property Acknowledgment Receipt (PAR)**.

To use a QR code:

1. Open the camera or QR scanner on a phone.
2. Scan the code.
3. Open the displayed link.
4. Confirm that the property number and item description are correct.
5. Print the form if a paper copy is required.

## Troubleshooting

### The page is still loading

Check the internet connection and wait a few seconds. Reload the page if it remains stuck. If other websites work but this application does not, report the issue to the application administrator.

### No cards appear

Check that the device is online and refresh the page. If the problem continues, contact the person responsible for the application or database access.

### Excel creates no cards

Check that the data is on the first worksheet, the headings are on row 5, and the classification says **Semi-Expendable** or **Non-Expendable**.

### An edit does not save

For a property card, wait briefly after editing. For an inventory tag, click outside the edited field. Refresh the page to confirm the saved value.

### A department or card is missing from the filter

Check the department value on the card. Filters use the department saved on the record. Reset the filter and search, then reload the page if necessary.

### The QR code does not open

Check that the phone has internet access. If the link opens but shows the wrong form, check whether the property number contains `SPLV` or `SPHV`.

### Duplicate records appear

Do not re-import the same spreadsheet immediately. First search for the property number and confirm whether the record already exists. Ask the administrator to review duplicates before deleting anything.

### Printing looks wrong

In the browser print dialog, check paper size, scale, margins, and orientation. Review the preview before printing.

## Important Reminder

The application stores live operational records. Confirm edits and printed output before processing a large batch, and follow the office's approved backup and records procedures.

## End-of-Task Checklist

- [ ] All imported records were reviewed.
- [ ] Missing fields were completed.
- [ ] Property and inventory numbers were checked.
- [ ] Required forms or tags were printed and reviewed.
- [ ] Changes were allowed time to save.
- [ ] The source spreadsheet was retained according to office policy.
