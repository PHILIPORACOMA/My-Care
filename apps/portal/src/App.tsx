import { AppShell, Button, Spinner, type NavItem } from "@mycare/ui";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MapPage } from "./pages/MapPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SyncStatusPage } from "./pages/SyncStatusPage";
import { TrendsPage } from "./pages/TrendsPage";

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/trends", label: "Trends & surveillance" },
  { to: "/sync", label: "Sync & status" },
  { to: "/reports", label: "Data & reports" },
  { to: "/map", label: "Aggregate map" },
];

export function App() {
  const { user, checking, logout } = useAuth();

  if (checking) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppShell
      brand="My Care"
      subtitle="Health worker portal"
      mark="MC"
      nav={NAV}
      renderLink={(item) => (
        <NavLink to={item.to} end={item.to === "/"}>
          {item.label}
        </NavLink>
      )}
      footer={
        <>
          <span>{user.email}</span>
          <span>{user.barangayName ?? "All barangays"}</span>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </>
      }
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/sync" element={<SyncStatusPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
