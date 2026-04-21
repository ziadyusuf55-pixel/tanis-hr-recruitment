import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";
const BRAND = "oklch(0.32 0.18 28)";

type Mode = "welcome" | "admin" | "agent";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("welcome");

  // Agent login state
  const [traineeCode, setTraineeCode] = useState("");
  const [password, setPassword] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  const agentLoginMutation = trpc.agent.login.useMutation();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  async function handleAgentLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!traineeCode.trim() || !password.trim()) {
      toast.error("Please enter your Trainee ID and password.");
      return;
    }
    setAgentLoading(true);
    try {
      await agentLoginMutation.mutateAsync({ traineeCode: traineeCode.trim(), password });
      navigate("/agent");
    } catch {
      toast.error("Invalid Trainee ID or password. Please try again.");
    } finally {
      setAgentLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden md:flex flex-col justify-between w-1/2 p-12"
        style={{ background: BRAND }}
      >
        <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-36 object-contain" />
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">Tanis Hub</h1>
          <p className="text-white/70 text-base max-w-xs">
            Your all-in-one platform for recruitment, onboarding, and training operations.
          </p>
        </div>
        <p className="text-white/40 text-xs">© {new Date().getFullYear()} Tanis. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-col items-center justify-center flex-1 bg-background px-8">
        {/* Mobile logo */}
        <div
          className="md:hidden flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: BRAND }}
        >
          <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-10 h-10 object-contain" />
        </div>

        {/* ── Welcome screen ── */}
        {mode === "welcome" && (
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to Tanis Hub</h2>
              <p className="text-sm text-muted-foreground">Choose how you want to sign in.</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setMode("admin")}
                className="w-full h-14 rounded-xl font-medium text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center gap-4 px-5"
                style={{ background: BRAND }}
              >
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold">Admin Login</div>
                  <div className="text-white/70 text-xs font-normal">Recruitment & HR management</div>
                </div>
              </button>

              <button
                onClick={() => setMode("agent")}
                className="w-full h-14 rounded-xl font-medium text-sm border-2 transition-all hover:bg-muted active:scale-[0.98] flex items-center gap-4 px-5"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(0.32 0.18 28 / 0.1)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold">Agent Login</div>
                  <div className="text-xs font-normal opacity-70">View your profile & training</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Admin login ── */}
        {mode === "admin" && (
          <div className="w-full max-w-sm space-y-8">
            <button onClick={() => setMode("welcome")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </button>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Admin Sign In</h2>
              <p className="text-sm text-muted-foreground">Sign in with your Tanis account to access the recruitment dashboard.</p>
            </div>
            <button
              onClick={() => { window.location.href = getLoginUrl(); }}
              disabled={loading}
              className="w-full h-11 rounded-lg font-medium text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
              style={{ background: BRAND }}
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <img src={TANIS_LOGO_WHITE} alt="" className="w-4 h-4 object-contain" />
                  Sign in with Tanis
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Admin access only. Contact your administrator if you need an account.
            </p>
          </div>
        )}

        {/* ── Agent login ── */}
        {mode === "agent" && (
          <div className="w-full max-w-sm space-y-8">
            <button onClick={() => setMode("welcome")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </button>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Agent Sign In</h2>
              <p className="text-sm text-muted-foreground">Enter your Trainee ID and password to access your portal.</p>
            </div>
            <form onSubmit={handleAgentLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="traineeCode">Trainee ID</Label>
                <Input
                  id="traineeCode"
                  placeholder="e.g. TN-0042"
                  value={traineeCode}
                  onChange={(e) => setTraineeCode(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                disabled={agentLoading}
                className="w-full h-11 font-medium text-sm text-white"
                style={{ background: BRAND }}
              >
                {agentLoading ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Sign In"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Your credentials were provided by your recruiter. Contact HR if you need help.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
