import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 22L14 6L22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.5 17H19.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Tanis HR</h1>
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
