import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = trpc.agent.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully! Welcome to Tanis Hub.");
      navigate("/agent");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    changePassword.mutate({ newPassword });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.004_30)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-3"
            style={{ background: "oklch(0.28 0.18 28)" }}
          >
            <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-9 h-9 object-contain" />
          </div>
          <span className="font-bold text-lg text-foreground" style={{ fontFamily: "'Sora', sans-serif" }}>
            Tanis Hub
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-border p-8">
          {/* Lock icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground text-center" style={{ fontFamily: "'Sora', sans-serif" }}>
              Set Your New Password
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-1.5 leading-relaxed">
              For your security, please set a new password before accessing your portal. Choose something strong and memorable.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">New Password</label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowNew(v => !v)}
                  tabIndex={-1}
                >
                  {showNew ? (
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

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? (
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

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-white"
              style={{ background: "oklch(0.28 0.18 28)" }}
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : "Set Password & Continue"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          This is a one-time step. You won't be asked again after setting your password.
        </p>
      </div>
    </div>
  );
}
