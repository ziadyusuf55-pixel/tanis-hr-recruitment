import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";

type Mode = "welcome" | "admin" | "agent";

/* ─── Geometric SVG background for the brand panel ─── */
function BrandPanelBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Large circle top-right */}
      <circle cx="110%" cy="-10%" r="55%" fill="oklch(0.40 0.20 28 / 0.35)" />
      {/* Medium circle bottom-left */}
      <circle cx="-15%" cy="110%" r="45%" fill="oklch(0.40 0.20 28 / 0.25)" />
      {/* Small accent circle */}
      <circle cx="75%" cy="60%" r="18%" fill="oklch(0.50 0.22 28 / 0.20)" />
      {/* Diagonal lines */}
      <line x1="0" y1="100%" x2="100%" y2="0" stroke="oklch(1 0 0 / 0.04)" strokeWidth="1.5" />
      <line x1="-10%" y1="80%" x2="90%" y2="-20%" stroke="oklch(1 0 0 / 0.04)" strokeWidth="1.5" />
      <line x1="10%" y1="110%" x2="110%" y2="10%" stroke="oklch(1 0 0 / 0.04)" strokeWidth="1.5" />
      {/* Dot grid */}
      <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.2" fill="oklch(1 0 0 / 0.08)" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

/* ─── Stat pill ─── */
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/15">
      <span className="text-white text-xl font-bold font-[Sora]">{value}</span>
      <span className="text-white/60 text-xs mt-0.5">{label}</span>
    </div>
  );
}

/* ─── Spinner ─── */
function Spinner() {
  return <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("welcome");

  const [traineeCode, setTraineeCode] = useState("");
  const [password, setPassword] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex bg-[oklch(0.97_0.004_30)]">
      {/* ══════════════ LEFT BRAND PANEL ══════════════ */}
      <div
        className="hidden lg:flex flex-col relative overflow-hidden w-[52%] shrink-0"
        style={{ background: "oklch(0.28 0.18 28)" }}
      >
        <BrandPanelBg />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-32 object-contain" />
          </div>

          {/* Hero text */}
          <div className="mt-auto mb-auto pt-16">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 text-xs font-medium tracking-wide uppercase">Tanis hub</span>
            </div>
            <h1
              className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Local Voices<br />
              <span className="text-white/50">Global Impact</span>
            </h1>
            <p className="mt-5 text-white/60 text-base leading-relaxed max-w-sm">
              Tanis Hub is your all-in-one platform for managing the full agent lifecycle — from first application to active deployment.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mt-auto">
            <StatPill value="150+" label="Active Agents" />
            <StatPill value="10+" label="Clients Served" />
            <StatPill value="Alex, EG" label="Headquarters" />
          </div>

          {/* Footer */}
          <p className="text-white/25 text-xs mt-8">
            © {new Date().getFullYear()} Tanis. All rights reserved.
          </p>
        </div>
      </div>

      {/* ══════════════ RIGHT FORM PANEL ══════════════ */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "oklch(0.28 0.18 28)" }}
          >
            <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-9 h-9 object-contain" />
          </div>
          <span className="text-foreground font-bold text-lg" style={{ fontFamily: "'Sora', sans-serif" }}>Tanis Hub</span>
        </div>

        {/* ── WELCOME ── */}
        {mode === "welcome" && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="mb-10">
              <h2
                className="text-[2rem] font-bold text-foreground tracking-tight leading-tight"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Welcome back
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px]">
                Sign in to your Tanis Hub account to continue.
              </p>
            </div>

            <div className="space-y-3">
              {/* Admin card */}
              <button
                onClick={() => setMode("admin")}
                className="group w-full rounded-2xl border-2 border-border bg-white hover:border-[oklch(0.28_0.18_28)] hover:shadow-xl transition-all duration-200 p-5 flex items-center gap-4 text-left shadow-sm"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200"
                  style={{ background: "oklch(0.28 0.18 28)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-base">Admin Portal</div>
                  <div className="text-muted-foreground text-xs mt-0.5">Recruitment & HR management</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-[oklch(0.28_0.18_28)] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </button>

              {/* Agent card */}
              <button
                onClick={() => setMode("agent")}
                className="group w-full rounded-2xl border-2 border-border bg-white hover:border-[oklch(0.28_0.18_28)] hover:shadow-xl transition-all duration-200 p-5 flex items-center gap-4 text-left shadow-sm"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200"
                  style={{ background: "oklch(0.94 0.015 28)" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ color: "oklch(0.28 0.18 28)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-base">Agent Portal</div>
                  <div className="text-muted-foreground text-xs mt-0.5">View your profile, training & payroll</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-[oklch(0.28_0.18_28)] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </button>
            </div>

            <div className="mt-10 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">Tanis Hub · 2026</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        {/* ── ADMIN LOGIN ── */}
        {mode === "admin" && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300">
            <button
              onClick={() => setMode("welcome")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back
            </button>

            <div className="mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-md"
                style={{ background: "oklch(0.28 0.18 28)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2
                className="text-2xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Admin Sign In
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5">
                Access the recruitment dashboard and HR management tools.
              </p>
            </div>

            <button
              onClick={() => { window.location.href = getLoginUrl(); }}
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-md"
              style={{ background: "oklch(0.28 0.18 28)" }}
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <img src={TANIS_LOGO_WHITE} alt="" className="w-4 h-4 object-contain" />
                  Continue with Tanis Account
                </>
              )}
            </button>

            <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
              </svg>
              <p className="text-xs text-amber-700 leading-relaxed">
                Admin access is restricted to authorized Tanis accounts. Contact your administrator if you need access.
              </p>
            </div>
          </div>
        )}

        {/* ── AGENT LOGIN ── */}
        {mode === "agent" && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300">
            <button
              onClick={() => setMode("welcome")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back
            </button>

            <div className="mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-md"
                style={{ background: "oklch(0.96 0.012 28)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" style={{ color: "oklch(0.28 0.18 28)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h2
                className="text-2xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Agent Sign In
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5">
                Enter your credentials to access your personal portal.
              </p>
            </div>

            <form onSubmit={handleAgentLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="traineeCode" className="text-sm font-medium text-foreground">
                  Trainee ID
                </Label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
                    </svg>
                  </div>
                  <Input
                    id="traineeCode"
                    placeholder="e.g. TN-0042"
                    value={traineeCode}
                    onChange={(e) => setTraineeCode(e.target.value)}
                    autoComplete="username"
                    className="pl-10 h-11 rounded-xl border-border focus:border-[oklch(0.28_0.18_28)] focus:ring-[oklch(0.28_0.18_28)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pl-10 pr-11 h-11 rounded-xl border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={agentLoading}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-md mt-2"
                style={{ background: "oklch(0.28 0.18 28)" }}
              >
                {agentLoading ? <Spinner /> : (
                  <>
                    Sign In to Portal
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
              Your credentials were provided by your recruiter.<br />
              Contact HR if you need assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
