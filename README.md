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

