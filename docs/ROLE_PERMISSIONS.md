# Role permissions

The API is the authorization boundary. Frontend navigation and hidden controls
mirror these rules for usability but do not grant access.

| Capability | Pharmacist | Admin | Main admin |
|---|---|---|---|
| Active inventory and routine medicine management | Yes | Yes | Yes |
| Inactive medicine records, reactivation, permanent deletion | No | Yes | Yes |
| Create sales; view sales and sales totals | Own sales only | All sales | All sales |
| View sale costs/profit and business-wide financial analytics | No | Yes | Yes |
| Process a return | Only for a sale they served | Any sale | Any sale |
| View returns | Own processed returns | All returns | All returns |
| View/edit controlled-drug records | Own records | All records | All records |
| Inventory imports | Yes | Yes | Yes |
| Reports and audit logs | No | Yes | Yes |
| Manage users | No | Pharmacists and own profile | Admins, pharmacists, and own profile |
| Create/assign the `admin` role | No | No | Yes |
| System backup/restore and destructive actions | No | No | Yes |
| Personal notification preferences | Own | Own | Own |

Admins may create and manage pharmacists, but cannot create or promote accounts
to `admin`, change another admin, change their own role, or deactivate their own
account. Only the main admin may assign `admin`; `main_admin` is permanent and
cannot be assigned to another account. The legacy `cashier` role is normalized
to `pharmacist`; any other unsupported stored role is denied at authentication.

Pharmacists can use active inventory pricing fields needed by existing stock
and dispensing workflows. Sale and return responses omit purchase costs and
profit fields for pharmacists; dashboard sales trends and recent sales are
limited to the pharmacist's own transactions. Business-wide stock counts
remain visible for routine inventory operations.

Backend authorization tests run with `cd backend && npm test`.
