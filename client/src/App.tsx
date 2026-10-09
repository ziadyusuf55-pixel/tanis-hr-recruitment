import { Toaster } from "@/components/ui/sonner";
import { canAccessPath, firstAllowedPath, hasAnyAccess, isFullAccess } from "@/lib/roleTabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import { trpc as trpcClient } from "@/lib/trpc";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "./components/DashboardLayout";

// F19: every page is its own chunk — the browser only downloads the screen being opened.
// After a redeploy, an open tab may ask for a chunk that no longer exists: reload once to pick up
// the new build instead of landing on the error screen.
function lazyPage<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().then(
    (m) => { try { sessionStorage.removeItem("chunk-reload"); } catch { /* storage blocked */ } return m; },
    (err) => {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem("chunk-reload") === "1"; sessionStorage.setItem("chunk-reload", "1"); } catch { /* storage blocked */ }
      if (!reloaded) { window.location.reload(); return new Promise<{ default: T }>(() => {}); }
      throw err;
    },
  ));
}
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Candidates = lazyPage(() => import("./pages/Candidates"));
const CandidateDetail = lazyPage(() => import("./pages/CandidateDetail"));
const Training = lazyPage(() => import("./pages/Training"));
const Requests = lazyPage(() => import("./pages/Requests"));
const Settings = lazyPage(() => import("./pages/Settings"));
const AdminInviteAccept = lazyPage(() => import("./pages/AdminInviteAccept"));
const AgentPortal = lazyPage(() => import("./pages/AgentPortal"));
const Operations = lazyPage(() => import("./pages/Operations"));
const FormerAgents = lazyPage(() => import("./pages/FormerAgents"));
const Payroll = lazyPage(() => import("./pages/Payroll"));
const AdminAudit = lazyPage(() => import("./pages/AdminAudit"));
const PerformanceDashboard = lazyPage(() => import("./pages/PerformanceDashboard"));
const AdherenceLog = lazyPage(() => import("./pages/AdherenceLog"));
const QualityLog = lazyPage(() => import("./pages/QualityLog"));
const PaymentPreferences = lazyPage(() => import("./pages/PaymentPreferences"));
const AllDocuments = lazyPage(() => import("./pages/AllDocuments"));
const CycleTrackerAdmin = lazyPage(() => import("./pages/CycleTrackerAdmin"));
const AgentProfilePage = lazyPage(() => import("./pages/AgentProfilePage"));
const PerformanceReports = lazyPage(() => import("./pages/PerformanceReports"));
const CoachingAdmin = lazyPage(() => import("./pages/CoachingAdmin"));
const CommissionAdmin = lazyPage(() => import("./pages/CommissionAdmin"));
const BusinessDevelopment = lazyPage(() => import("./pages/BusinessDevelopment"));
const AgentProfileHR = lazyPage(() => import("./pages/AgentProfileHR"));
const LeaveManagement = lazyPage(() => import("./pages/LeaveManagement"));
const Contracts = lazyPage(() => import("./pages/Contracts"));
const Advances = lazyPage(() => import("./pages/Advances"));
const OTLog = lazyPage(() => import("./pages/OTLog"));
const MyProfile = lazyPage(() => import("./pages/MyProfile"));
const Academy = lazyPage(() => import("./pages/Academy"));
const Clients = lazyPage(() => import("./pages/Clients"));
const ClientDashboardPage = lazyPage(() => import("./pages/ClientDashboardPage"));
const TimeTrackingAdmin = lazyPage(() => import("./pages/TimeTrackingAdmin"));
const TimeTrackerPage = lazyPage(() => import("./pages/TimeTrackerPage"));
const ClientLogoutsAdmin = lazyPage(() => import("./pages/ClientLogoutsAdmin"));
const ChangePasswordPage = lazyPage(() => import("./pages/ChangePasswordPage"));

const PageFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/candidates" component={() => <ProtectedRoute component={Candidates} />} />
      <Route path="/candidates/:id" component={() => <ProtectedRoute component={CandidateDetail} />} />
      <Route path="/training" component={() => <ProtectedRoute component={Training} />} />
      <Route path="/operations" component={() => <ProtectedRoute component={Operations} />} />
      <Route path="/former-agents" component={() => <ProtectedRoute component={FormerAgents} />} />
      <Route path="/operations/agents/:code" component={() => <ProtectedRoute component={AgentProfilePage} />} />
      <Route path="/payroll" component={() => <ProtectedRoute component={Payroll} />} />
      <Route path="/admin-audit" component={() => <ProtectedRoute component={AdminAudit} />} />
      <Route path="/commission" component={() => <ProtectedRoute component={CommissionAdmin} />} />
      <Route path="/business-development" component={() => <ProtectedRoute component={BusinessDevelopment} />} />
      <Route path="/agent-profiles" component={() => <ProtectedRoute component={AgentProfileHR} />} />
      <Route path="/contracts" component={() => <ProtectedRoute component={Contracts} />} />
      <Route path="/advances"  component={() => <ProtectedRoute component={Advances} />} />
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
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/clients/:id" component={() => <ProtectedRoute component={ClientDashboardPage} />} />
      <Route path="/time-tracking" component={() => <ProtectedRoute component={TimeTrackingAdmin} />} />
      <Route path="/agent/tracker" component={TimeTrackerPage} />
      <Route path="/requests" component={() => <ProtectedRoute component={Requests} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/admin-invite" component={AdminInviteAccept} />
      <Route path="/agent/change-password" component={ChangePasswordPage} />
      <Route path="/agent" component={AgentPortal} />
      <Route path="/agent/login" component={AgentPortal} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
