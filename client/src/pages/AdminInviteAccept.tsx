import { useState } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

const TANIS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";

export default function AdminInviteAccept() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const { data: invite, isLoading, error } = trpc.adminAuth.validateInvite.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const acceptMutation = trpc.adminAuth.acceptInvite.useMutation({
    onSuccess: (data) => {
      if (data.accountAlreadyExists) {
        // Account already set up — just redirect to login
        toast.success("Your account is already set up. Please log in.");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 1500);
        return;
      }
      setDone(true);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    acceptMutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-xl bg-[#8B1A1A] flex items-center justify-center">
            <img src={TANIS_LOGO} alt="Tanis" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Tanis Hub Admin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Set up your admin account</p>
          </div>
        </div>

        {!token ? (
          <div className="text-center text-sm text-destructive">No invite token found in the URL.</div>
        ) : isLoading ? (
          <div className="text-center text-sm text-muted-foreground">Validating invite...</div>
        ) : error ? (
          <div className="text-center text-sm text-destructive">{error.message}</div>
        ) : done ? (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-semibold">Account created!</p>
              <p className="text-sm text-muted-foreground mt-1">You can now log in to the admin portal.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Go to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm">
              <p className="font-medium">{invite?.name}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{invite?.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
