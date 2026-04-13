import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Tanis brand */}
      <div
        className="hidden md:flex flex-col justify-between w-1/2 p-12"
        style={{ background: "oklch(0.32 0.18 28)" }}
      >
        <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-36 object-contain" />
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Tanis Hub
          </h1>
          <p className="text-white/70 text-base max-w-xs">
            Your all-in-one platform for recruitment, onboarding, and training operations.
          </p>
        </div>
        <p className="text-white/40 text-xs">© {new Date().getFullYear()} Tanis. All rights reserved.</p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex flex-col items-center justify-center flex-1 bg-background px-8">
        {/* Mobile logo */}
        <div
          className="md:hidden flex items-center justify-center w-16 h-16 rounded-2xl mb-8"
          style={{ background: "oklch(0.32 0.18 28)" }}
        >
          <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-10 h-10 object-contain" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access Tanis Hub.
            </p>
          </div>

          <button
            onClick={() => { window.location.href = getLoginUrl(); }}
            disabled={loading}
            className="w-full h-11 rounded-lg font-medium text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
            style={{ background: "oklch(0.32 0.18 28)" }}
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
            Recruiter access only. Contact your administrator if you need an account.
          </p>
        </div>
      </div>
    </div>
  );
}
