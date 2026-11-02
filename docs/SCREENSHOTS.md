# Portfolio screenshot checklist

Please capture screenshots from the running app using only fake/demo data. Do
not include real patient/customer records, private contact details, account
tokens, environment variables, or passwords. The login page intentionally
shows public demo credentials; crop or mask those values if a login screenshot
is supplied.

## Requested images

| Filename | View | Capture notes |
|---|---|---|
| `dashboard-desktop.png` | Admin dashboard, light theme | Show KPI cards, both charts, and at least one lower dashboard section. Prefer the sample preview if live demo data is sparse; keep its sample label visible. |
| `dashboard-dark.png` | Admin dashboard, dark theme | Include KPI icons, chart labels, and inventory alerts so contrast is easy to review. |
| `reports-desktop.png` | Reports & Analytics | Show the revenue/profit chart, comparison, and sample-data label if using preview mode. |
| `billing-desktop.png` | Billing / point of sale | Show a populated cart before checkout; do not submit a sale just to make the screenshot. |
| `inventory-desktop.png` | Inventory or medicine catalog | Show search/filter controls and visible stock/expiry status badges. |
| `pharmacist-dashboard.png` | Pharmacist dashboard | Show the role-specific inventory and alert workflow without admin-only controls. |
| `dashboard-mobile.png` | Dashboard at mobile width | Capture around 390 × 844 CSS pixels, with no browser devtools covering the page. |
| `login.png` *(optional)* | Login page | Only if desired; mask the displayed demo passwords before sharing. |

## Capture guidelines

- Desktop: 1440 × 900 or 1600 × 1000 pixels; capture the application viewport,
  not the full desktop or browser chrome.
- Mobile: approximately 390 × 844 CSS pixels.
- Use PNG or high-quality JPEG, with readable text and no clipped chart labels.
- Keep the dashboard/reports sample-preview banner visible when the displayed
  metrics are generated sample data.
- For billing, inventory, and sales, use the isolated demo database and do not
  create transactions solely for screenshots.
- Send the original image files, not screenshots pasted into a document. Once
  reviewed, they can be stored under `docs/screenshots/` and embedded in the
  README with descriptive alt text.
