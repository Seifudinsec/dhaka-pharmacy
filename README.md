# 💊 DHAKA PHARMACY — Inventory & Billing System

A complete, production-ready pharmacy management system built with React, Node.js/Express, and MongoDB.

---

## 🗂️ Folder Structure

```
dhaka-pharmacy/
├── backend/                  # Node.js + Express API
│   ├── config/
│   │   ├── db.js             # MongoDB connection
│   │   └── seed.js           # Seed admin + sample data
│   ├── middleware/
│   │   └── auth.js           # JWT protect middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Medicine.js
│   │   └── Sale.js
│   ├── routes/
│   │   ├── auth.js           # Login, register, /me
│   │   ├── medicines.js      # Full CRUD
│   │   ├── sales.js          # Create sale, history
│   │   ├── import.js         # Excel bulk import
│   │   └── dashboard.js      # Stats
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend/                 # React app
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── Dashboard.js
    │   │   ├── MedicinesPage.js
    │   │   ├── InventoryPage.js
    │   │   ├── BillingPage.js
    │   │   ├── SalesPage.js
    │   │   └── ImportPage.js
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    └── package.json
```

## Recruiter demo accounts

The login page shows two public demo profiles:

| Role | Username | Password |
|---|---|---|
| Admin | `demo-admin` | `DemoAdmin2026!` |
| Pharmacist | `demo-pharmacist` | `DemoPharmacy2026!` |

These are shared public credentials. Provision them only in an isolated demo
database with no real customer, employee, or business data. Set `MONGODB_URI`
in `backend/.env`, then create the accounts from the backend directory:

```sh
DEMO_MODE=true npm run seed:demo-users
```

The command refuses to run unless `DEMO_MODE=true` is set and will not overwrite
existing accounts. Do not point it at a production database.

## Deploying the recruiter demo

Use a **separate MongoDB database containing only disposable demo data**. The
public demo accounts can make changes according to their roles; never connect
them to real pharmacy, customer, or employee data.

### Render API

1. In MongoDB Atlas, create a database and database user for the demo. Allow
   connections from Render (Atlas may require `0.0.0.0/0` for Render services
   without static outbound IPs; use a dedicated database user with a strong
   password and grant access only to the demo database).
2. In Render, create a Blueprint from this repository using `render.yaml`.
   Set `MONGODB_URI` to the Atlas connection string and `FRONTEND_URL` to the
   exact public Vercel origin, for example `https://your-project.vercel.app`
   (no trailing slash). Render generates `JWT_SECRET` and supplies `PORT`.
3. Wait for the Render service to deploy and verify
   `https://<your-render-service>.onrender.com/api/health` returns a success
   response.

### Vercel frontend

1. Import the repository in Vercel and set the project root directory to
   `frontend`.
2. Add these Production environment variables, replacing the Render hostname:

   ```text
   REACT_APP_API_URL=https://<your-render-service>.onrender.com/api
   REACT_APP_SOCKET_URL=https://<your-render-service>.onrender.com
   ```

3. Deploy or redeploy. These `REACT_APP_*` values are embedded at build time.
   If using a custom frontend domain, update Render's `FRONTEND_URL` to that
   origin and redeploy the API so Socket.IO accepts it.

### Provision demo data

In the Render service Shell, run `npm run seed` **only once on the fresh demo
database** to create sample medicines. This command deletes existing users and
medicines, so never run it on a database with data to preserve. Then create the
public recruiter accounts:

```sh
DEMO_MODE=true npm run seed:demo-users
```

The login page displays the demo credentials. The seeder refuses to run if
either demo username already exists; use a fresh demo database if you need to
reprovision them.
