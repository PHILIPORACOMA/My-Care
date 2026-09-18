import { AppShell, Button, Spinner, type NavItem } from "@mycare/ui";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AuditLogPage } from "./pages/AuditLogPage";
import { LoginPage } from "./pages/LoginPage";
import { SyncHealthPage } from "./pages/SyncHealthPage";
import { SystemDashboardPage } from "./pages/SystemDashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { RulesetListPage } from "./rules/RulesetListPage";
import { RulesetVersionPage } from "./rules/RulesetVersionPage";
import { SymptomCodesPage } from "./rules/SymptomCodesPage";

const NAV: NavItem[] = [
  { to: "/", label: "System dashboard" },
  { to: "/rules", label: "Rules & lexicon" },
  { to: "/symptom-codes", label: "Symptom codes" },
  { to: "/users", label: "User management" },
  { to: "/sync", label: "Sync & system health" },
  { to: "/audit", label: "Audit log" },
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

  // Figure 36: access is restricted to the development team. A signed-in
  // sub-admin sees an explanation, not the console (the API refuses them too).
  if (!user || user.role !== "super_admin") {
    return <LoginPage wrongRole={user !== null && user.role !== "super_admin"} />;
  }

  return (
    <AppShell
      brand="My Care"
      subtitle="System administration"
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
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </>
      }
    >
      <Routes>
        <Route path="/" element={<SystemDashboardPage />} />
        <Route path="/rules" element={<RulesetListPage />} />
        <Route path="/rules/:id" element={<RulesetVersionPage />} />
        <Route path="/symptom-codes" element={<SymptomCodesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/sync" element={<SyncHealthPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
