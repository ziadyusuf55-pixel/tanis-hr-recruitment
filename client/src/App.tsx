import { Toaster } from "@/components/ui/sonner";
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
import PayrollStatus from "./pages/PayrollStatus";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import AdherenceLog from "./pages/AdherenceLog";
import QualityLog from "./pages/QualityLog";
import PaymentPreferences from "./pages/PaymentPreferences";
import AllDocuments from "./pages/AllDocuments";
import AgentProfilePage from "./pages/AgentProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "./components/DashboardLayout";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

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
      <Route path="/payroll-status" component={() => <ProtectedRoute component={PayrollStatus} />} />
      <Route path="/performance" component={() => <ProtectedRoute component={PerformanceDashboard} />} />
      <Route path="/adherence" component={() => <ProtectedRoute component={AdherenceLog} />} />
      <Route path="/quality" component={() => <ProtectedRoute component={QualityLog} />} />
      <Route path="/payment-preferences" component={() => <ProtectedRoute component={PaymentPreferences} />} />
      <Route path="/all-documents" component={() => <ProtectedRoute component={AllDocuments} />} />
      <Route path="/requests" component={() => <ProtectedRoute component={Requests} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/admin-invite" component={AdminInviteAccept} />
      <Route path="/agent/change-password" component={ChangePasswordPage} />
      <Route path="/agent" component={AgentPortal} />
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
