require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const medicineRoutes = require("./routes/medicines");
const salesRoutes = require("./routes/sales");
const importRoutes = require("./routes/import");
const dashboardRoutes = require("./routes/dashboard");
const usersRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const reportsRoutes = require("./routes/reports");
const returnsRoutes = require("./routes/returns");
const auditRoutes = require("./routes/audit");

const app = express();
const http = require("http");
const server = http.createServer(app);
const socketConfig = require("./config/socket");

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((uri) => uri.trim())
  : ["http://localhost:3000"];

// Initialize Socket.io
socketConfig.init(server, allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes("*")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/import", importRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/audit", auditRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Dhaka Pharmacy API is running",
    timestamp: new Date(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`✅ Server running on port ${PORT}`);
  }
});
