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

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

---

### 1. Clone / Extract the project

```bash
cd dhaka-pharmacy
```

---

### 2. Set up the Backend

```bash
cd backend
npm install
```

Create your `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and set your MongoDB URI:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/dhaka_pharmacy
JWT_SECRET=your_very_long_random_secret_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

**Seed the database** (creates admin user + sample medicines):
```bash
npm run seed
```

This creates:
- Admin login: **username: `admin`** / **password: `admin123`**
- 10 sample medicines

**Start the backend:**
```bash
npm run dev      # development (auto-reload)
# or
npm start        # production
```

Backend will run at: `http://localhost:5000`

---

### 3. Set up the Frontend

```bash
cd ../frontend
npm install
npm start
```

Frontend will run at: `http://localhost:3000`

The `"proxy": "http://localhost:5000"` in `package.json` forwards all `/api` calls to the backend automatically during development.

---

## 🔐 Default Login

| Field    | Value    |
|----------|----------|
| Username | `admin`  |
| Password | `admin123` |

> Change the password after first login in production.

---

## 📦 Features

| Module | Description |
|--------|-------------|
| Dashboard | Live stats — medicines, low stock, expired, today's sales |
| Medicines | Add / Edit / Delete with full validation |
| Inventory | View all stock with color-coded expiry & stock warnings |
| Billing | POS cart — select medicines, adjust qty, auto-calculate, confirm sale |
| Sales History | View all transactions, filter by date range, expand for line items |
| Bulk Import | Upload .xlsx file, validate rows, insert new / update existing |
| Search & Filter | Search by name, filter by stock status or expiry |
| Auth | JWT login, protected routes, bcrypt hashed passwords |

---

## 🌐 API Endpoints

All routes except `/api/auth/login` and `/api/health` require: `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/medicines` | List medicines (search, filter, paginate) |
| POST | `/api/medicines` | Add medicine |
| PUT | `/api/medicines/:id` | Update medicine |
| DELETE | `/api/medicines/:id` | Delete medicine |
| GET | `/api/sales` | Sales history (date filter, paginate) |
| POST | `/api/sales` | Create sale (deducts stock, uses DB transaction) |
| GET | `/api/sales/today` | Today's sales count & total |
| POST | `/api/import` | Bulk Excel import |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/health` | Health check |

---

## 📊 Excel Import Format

Your Excel file must have these column headers (case-insensitive):

| Column | Type | Example |
|--------|------|---------|
| `name` | Text | Paracetamol 500mg |
| `price` | Number | 5.50 |
| `stock` | Number | 100 |
| `expiryDate` | Date | 2026-12-31 |

- If a medicine with the same name already exists → it will be **updated**
- If the name is new → it will be **inserted**
- Invalid rows are reported but do not stop the import

Download a template from the Import page in the app.

---

## 🚢 Production Deployment

### Environment variables for production:
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/dhaka_pharmacy
JWT_SECRET=<random 64-char string>
FRONTEND_URL=https://your-frontend-domain.com
```

### Build the React frontend:
```bash
cd frontend
npm run build
```

Serve the `build/` folder via nginx, or from Express:
```js
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/build/index.html')));
```

### Recommended deployment:
- **Backend**: Railway, Render, or a VPS
- **Frontend**: Vercel, Netlify, or serve from Express
- **Database**: MongoDB Atlas (free tier available)

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios, react-hot-toast, date-fns |
| Backend | Node.js, Express 4, Helmet, express-rate-limit |
| Database | MongoDB with Mongoose ODM |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Parsing | multer (upload), xlsx (parse) |
| Dev | nodemon |
