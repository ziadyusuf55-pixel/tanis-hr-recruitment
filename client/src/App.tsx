import { Toaster } from "@/components/ui/sonner";
import { canAccessPath, firstAllowedPath, hasAnyAccess, isFullAccess } from "@/lib/roleTabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Candidates from "./pages/Candidates";
import CandidateDetail from "./pages/CandidateDetail";
import Training from "./pages/Training";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import AdminInviteAccept from "./pages/AdminInviteAccept";
import Login from "./pages/Login";
import AgentPortal from "./pages/AgentPortal";
import Operations from "./pages/Operations";
import Payroll from "./pages/Payroll";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import AdherenceLog from "./pages/AdherenceLog";
import QualityLog from "./pages/QualityLog";
import PaymentPreferences from "./pages/PaymentPreferences";
import AllDocuments from "./pages/AllDocuments";
import CycleTrackerAdmin from "./pages/CycleTrackerAdmin";
import AgentProfilePage from "./pages/AgentProfilePage";
import PerformanceReports from "./pages/PerformanceReports";
import CoachingAdmin from "./pages/CoachingAdmin";
import CommissionAdmin from "./pages/CommissionAdmin";
import BusinessDevelopment from "./pages/BusinessDevelopment";
import AgentProfileHR from "./pages/AgentProfileHR";
import LeaveManagement from "./pages/LeaveManagement";
import OTLog from "./pages/OTLog";
import MyProfile from "./pages/MyProfile";
import Academy from "./pages/Academy";
import { trpc as trpcClient } from "@/lib/trpc";
import ClientLogoutsAdmin from "./pages/ClientLogoutsAdmin";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "./components/DashboardLayout";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading, user } = useAuth();
  const [location, navigate] = useLocation();
  // Route-level lock: BD-role logins can ONLY access Business Development + Operations.
  const { data: me } = trpcClient.bd.me.useQuery(undefined, { staleTime: 60000, enabled: isAuthenticated });
  const isBd = me?.kind === "bd" || me?.kind === "unlinked";
  const bdAllowed = location.startsWith("/business-development") || location.startsWith("/operations");
  useEffect(() => {
    if (isAuthenticated && isBd && !bdAllowed) navigate("/business-development");
  }, [isAuthenticated, isBd, bdAllowed, navigate]);

  // Role-level lock: a user with a scoped role can't open a page outside their tabs.
  const role = (user as { role?: string } | null)?.role;
  useEffect(() => {
    if (isAuthenticated && !isBd && hasAnyAccess(role) && !isFullAccess(role) && !canAccessPath(role, location)) {
      navigate(firstAllowedPath(role));
    }
  }, [isAuthenticated, isBd, role, location, navigate]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/candidates" component={() => <ProtectedRoute component={Candidates} />} />
      <Route path="/candidates/:id" component={() => <ProtectedRoute component={CandidateDetail} />} />
      <Route path="/training" component={() => <ProtectedRoute component={Training} />} />
      <Route path="/operations" component={() => <ProtectedRoute component={Operations} />} />
      <Route path="/operations/agents/:code" component={() => <ProtectedRoute component={AgentProfilePage} />} />
      <Route path="/payroll" component={() => <ProtectedRoute component={Payroll} />} />
      <Route path="/commission" component={() => <ProtectedRoute component={CommissionAdmin} />} />
      <Route path="/business-development" component={() => <ProtectedRoute component={BusinessDevelopment} />} />
      <Route path="/agent-profiles" component={() => <ProtectedRoute component={AgentProfileHR} />} />
      <Route path="/leave-management" component={() => <ProtectedRoute component={LeaveManagement} />} />
      <Route path="/ot" component={() => <ProtectedRoute component={OTLog} />} />
      <Route path="/my-profile" component={() => <ProtectedRoute component={MyProfile} />} />
      <Route path="/academy" component={() => <ProtectedRoute component={Academy} />} />
      {/* PayrollStatus removed — use /payroll instead */}
      <Route path="/performance" component={() => <ProtectedRoute component={PerformanceDashboard} />} />
      <Route path="/adherence" component={() => <ProtectedRoute component={AdherenceLog} />} />
      <Route path="/quality" component={() => <ProtectedRoute component={QualityLog} />} />
      <Route path="/payment-preferences" component={() => <ProtectedRoute component={PaymentPreferences} />} />
      <Route path="/all-documents" component={() => <ProtectedRoute component={AllDocuments} />} />
      <Route path="/cycle-tracker" component={() => <ProtectedRoute component={CycleTrackerAdmin} />} />
      <Route path="/performance-reports" component={() => <ProtectedRoute component={PerformanceReports} />} />
      <Route path="/coaching-admin" component={() => <ProtectedRoute component={CoachingAdmin} />} />
      <Route path="/client-logouts" component={() => <ProtectedRoute component={ClientLogoutsAdmin} />} />
      <Route path="/requests" component={() => <ProtectedRoute component={Requests} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/admin-invite" component={AdminInviteAccept} />
      <Route path="/agent/change-password" component={ChangePasswordPage} />
      <Route path="/agent" component={AgentPortal} />
      <Route path="/agent/login" component={AgentPortal} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
