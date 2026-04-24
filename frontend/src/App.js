import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  faBars,
  faBoxesStacked,
  faCircleExclamation,
  faChartLine,
  faFileImport,
  faFileInvoiceDollar,
  faGear,
  faMoneyBillTrendUp,
  faMoon,
  faSun,
  faPills,
  faPrescriptionBottleMedical,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import api from "./utils/api";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import MedicinesPage from "./pages/MedicinesPage";
import InventoryPage from "./pages/InventoryPage";
import BillingPage from "./pages/BillingPage";
import SalesPage from "./pages/SalesPage";
import ImportPage from "./pages/ImportPage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import SpecialDrugsPage from "./pages/SpecialDrugsPage";
import AppIcon from "./components/common/AppIcon";
import InstallAppButton from "./components/common/InstallAppButton";
import NotificationBell from "./components/common/NotificationBell";
import NotificationPopup from "./components/common/NotificationPopup";
import "./index.css";

const getNavigationItems = (userRole) => {
  const baseNav = [
    { path: "/", icon: faChartLine, label: "Dashboard", exact: true },
    { path: "/medicines", icon: faPills, label: "Medicines" },
    { path: "/inventory", icon: faBoxesStacked, label: "Inventory" },
    { path: "/billing", icon: faFileInvoiceDollar, label: "Billing" },
    { path: "/sales", icon: faMoneyBillTrendUp, label: "Sales History" },
    {
      path: "/special-drugs",
      icon: faPrescriptionBottleMedical,
      label: "Special Drugs",
    },
    { path: "/import", icon: faFileImport, label: "Bulk Import" },
  ];

  if (userRole === "admin") {
    return [
      ...baseNav,
      { path: "/reports", icon: faChartLine, label: "Reports & Analytics" },
      { path: "/users", icon: faGear, label: "User Management" },
    ];
  }

  return baseNav;
};

// Dark/light mode toggle button — visible in header for ALL users
const ThemeToggleBtn = ({ theme, onToggle }) => (
  <button
    className="theme-toggle-btn"
    onClick={onToggle}
    aria-label={
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    }
    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
  >
    <AppIcon icon={theme === "dark" ? faSun : faMoon} />
  </button>
);

const Sidebar = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navigationItems = getNavigationItems(user?.role);

  return (
    <>
      {open && <div className="nav-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-logo">
          <img
            src="/dhaka-pharmacy-logo.png"
            alt="Dhaka Pharmacy logo"
            style={{
              width: 44,
              height: 44,
              objectFit: "contain",
              borderRadius: 6,
            }}
          />
          <div className="sidebar-logo-text">
            <strong>DHAKA</strong>
            <span>PHARMACY</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Main Menu</div>
          {navigationItems.map(({ path, icon, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
              onClick={onClose}
            >
              <AppIcon icon={icon} size="lg" className="nav-icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            className="user-info"
            style={{ cursor: "pointer" }}
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
          >
            <div className="user-avatar">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{user?.username}</strong>
              <span>{user?.role === 'admin' ? 'Admin' : 'Pharmacist'}</span>
            </div>
          </div>
          {user?.role === "admin" && (
            <button
              className="nav-item"
              onClick={() => {
                onClose();
                navigate("/settings");
              }}
            >
              <AppIcon icon={faGear} size="lg" className="nav-icon" />
              Settings
            </button>
          )}
          <button className="nav-item nav-item-danger" onClick={logout}>
            <AppIcon icon={faRightFromBracket} size="lg" className="nav-icon" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

const AppLayout = ({ theme, setTheme }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [notificationSettings, setNotificationSettings] = useState(() => {
    try {
      const cached = localStorage.getItem("dhaka_notification_settings");
      return cached
        ? JSON.parse(cached)
        : {
            notificationPreferences: {
              lowStock: true,
              expiry: true,
              dailySales: false,
            },
          };
    } catch {
      return {
        notificationPreferences: {
          lowStock: true,
          expiry: true,
          dailySales: false,
        },
      };
    }
  });
  const location = useLocation();
  const navigationItems = getNavigationItems(user?.role);
  const currentPage = navigationItems.find((n) =>
    n.exact
      ? location.pathname === n.path
      : location.pathname.startsWith(n.path),
  );

  useEffect(() => {
    if (!user) return;
    const loadNotificationSettings = async () => {
      try {
        const { data } = await api.get("/settings/notifications/me");
        if (data.success) {
          setNotificationSettings(data.data);
          localStorage.setItem(
            "dhaka_notification_settings",
            JSON.stringify(data.data),
          );
        }
      } catch {
        // Keep cached settings if request fails
      }
    };
    loadNotificationSettings();
  }, [user]);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <header className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-secondary btn-icon sidebar-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarOpen(true);
              }}
              aria-label="Open menu"
            >
              <AppIcon icon={faBars} />
            </button>
            <img
              src="/dhaka-pharmacy-logo.png"
              alt="Dhaka Pharmacy"
              style={{
                width: 34,
                height: 34,
                objectFit: "contain",
                borderRadius: 4,
              }}
            />
            <h1 className="page-title">
              <AppIcon
                icon={currentPage?.icon || faGear}
                className="page-title-icon"
              />
              {currentPage?.label ||
                (location.pathname === "/settings"
                  ? "Settings"
                  : "Dhaka Pharmacy")}
            </h1>
          </div>
          <div className="header-actions">
            {isOffline && (
              <div
                className="offline-badge"
                title="Working offline"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--danger-light)",
                  color: "var(--danger-600)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <AppIcon icon={faCircleExclamation} />
                Offline
              </div>
            )}
            <div className="header-controls">
              <NotificationBell />
              <InstallAppButton />
              <ThemeToggleBtn
                theme={theme}
                onToggle={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
              />
            </div>
            <span className="header-meta">
              {new Date().toLocaleDateString("en-KE", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/medicines" element={<MedicinesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/special-drugs" element={<SpecialDrugsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route
              path="/reports"
              element={
                user?.role === "admin" ? <ReportsPage /> : <Navigate to="/" />
              }
            />
            <Route
              path="/users"
              element={
                user?.role === "admin" ? (
                  <UsersManagementPage />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/settings"
              element={
                user?.role === "admin" ? (
                  <SettingsPage
                    theme={theme}
                    onThemeChange={setTheme}
                    notificationSettings={notificationSettings}
                    onNotificationSettingsChange={setNotificationSettings}
                  />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("dhaka_theme") || "light",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dhaka_theme", theme);
  }, [theme]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontSize: 14, borderRadius: 10, fontWeight: 500 },
            }}
          />
          <NotificationPopup />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout theme={theme} setTheme={setTheme} />
                </ProtectedRoute>
              }
            />
          </Routes>
        </NotificationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
