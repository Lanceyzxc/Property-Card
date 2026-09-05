# UCN ProCard System User Guide

This guide is for office staff and anyone who uses the application to create, review, and print property records.

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

Open the published application in a browser. The first page is the **Property Cards** page.

The application needs an internet connection because it uses online storage and browser libraries.

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

## Working With Property Cards

### Edit a card

Click or type into a card field to add or correct information. Changes are saved automatically after a short delay.

Each card has a QR code. The code opens the record's form when scanned.

### Filter and search

Use the left-side controls to:

- Filter cards by department.
- Search for card information.
- Reset the filter and search.
- Move between pages of cards.
- Change field text between enhanced and plain colors.

The dashboard shows the total number of cards and the number currently visible.

### Add blank cards

Use **Add New Cards** to choose a department and create one or more blank cards.

### Select, print, or delete cards

Open **Batch Actions** to select cards.

- **Select All** selects every card.
- **Select Visible** selects cards currently shown by the filter.
- **Clear Selection** removes the selection.
- **Print Selected** prints only selected cards.
- **Delete Selected** removes selected cards after confirmation.
- **Print Tags** prints all available cards.

Always check the browser print preview before printing a full batch.

## Working With Inventory Tags

1. Open **Inventory Tags** from the Property Cards page.
2. Search by property number, article, serial number, department, or location.
3. Choose a department if needed.
4. Edit text directly on a tag.
5. Click outside an edited field so the change can be saved.
6. Print all visible tags or select specific tags and print them.

Missing inventory numbers are assigned automatically in the format `YY-NNNN`, for example `26-0001`.

## QR Codes And Forms

The form depends on the property number:

- A property number containing `SPLV` or `SPHV` opens an **Inventory Custodian Slip (ICS)**.
- Other property numbers open a **Property Acknowledgment Receipt (PAR)**.

## Troubleshooting

### No cards appear

Check that the device is online and refresh the page. If the problem continues, contact the person responsible for the application or database access.

### Excel creates no cards

Check that the data is on the first worksheet, the headings are on row 5, and the classification says **Semi-Expendable** or **Non-Expendable**.

### An edit does not save

For a property card, wait briefly after editing. For an inventory tag, click outside the edited field. Refresh the page to confirm the saved value.

### Printing looks wrong

In the browser print dialog, check paper size, scale, margins, and orientation. Review the preview before printing.

## Important Reminder

The application stores live operational records. Confirm edits and printed output before processing a large batch, and follow the office's approved backup and records procedures.
