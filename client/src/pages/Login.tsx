import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const TANIS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo_3fe319f4.png";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-md border border-border mb-5">
            <img src={TANIS_LOGO} alt="Tanis" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">TANIS</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Recruitment Management System</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to access your recruitment dashboard.
          </p>

          <a href={getLoginUrl()} className="block w-full">
            <Button className="w-full h-11 text-sm font-medium" size="lg">
              Sign in to continue
            </Button>
          </a>

          <p className="text-xs text-muted-foreground text-center mt-5">
            Access is restricted to authorized recruiters only.
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          © {new Date().getFullYear()} Tanis. All rights reserved.
        </p>
      </div>
    </div>
  );
}
