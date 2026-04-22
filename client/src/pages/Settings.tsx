import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, Copy, Check, ShieldOff, ShieldCheck, Mail } from "lucide-react";

export default function Settings() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: admins, refetch } = trpc.adminAuth.list.useQuery();

  const inviteMutation = trpc.adminAuth.invite.useMutation({
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setInviteName("");
      setInviteEmail("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const setActiveMutation = trpc.adminAuth.setActive.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Admin status updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Please fill in name and email");
      return;
    }
    inviteMutation.mutate({ name: inviteName.trim(), email: inviteEmail.trim() });
  };

  const inviteLink = generatedToken
    ? `${window.location.origin}/admin-invite?token=${generatedToken}`
    : null;

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage admin access and platform settings.</p>
      </div>

      {/* Admin Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base">Admin Accounts</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              Invite team members to access the admin portal with their own email and password.
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setGeneratedToken(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite a New Admin</DialogTitle>
              </DialogHeader>
              {!generatedToken ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input
                      placeholder="e.g. Sara Ahmed"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="sara@tanis-eg.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    An invite link will be generated. Share it with the person — it expires in 48 hours.
                  </p>
                  <Button
                    className="w-full"
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Invite link generated!</p>
                    <p className="text-xs text-green-700 dark:text-green-400">Share this link with the new admin. It expires in 48 hours.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLink ?? ""}
                      className="text-xs font-mono"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The admin will set their own password when they open this link.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => { setGeneratedToken(null); setInviteOpen(false); }}>
                    Done
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!admins || admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No additional admins yet. Invite your first team member above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{admin.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    {admin.invitedBy && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Invited by {admin.invitedBy}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Badge variant={admin.isActive ? "default" : "secondary"} className="text-xs">
                      {admin.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={admin.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {admin.isActive
                            ? <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                            : <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                          }
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {admin.isActive ? "Deactivate" : "Reactivate"} {admin.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {admin.isActive
                              ? "This will immediately revoke their access to the admin portal."
                              : "This will restore their access to the admin portal."
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => setActiveMutation.mutate({ id: admin.id, isActive: !admin.isActive })}
                            className={admin.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
                          >
                            {admin.isActive ? "Deactivate" : "Reactivate"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Platform security measures currently active.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Agent login rate limiting", desc: "Accounts lock after 5 failed attempts for 15 minutes" },
            { label: "Admin login rate limiting", desc: "Accounts lock after 5 failed attempts for 15 minutes" },
            { label: "Invite link expiry", desc: "Admin invite links expire after 48 hours" },
            { label: "Password hashing", desc: "All passwords are bcrypt-hashed (cost factor 12)" },
            { label: "Session cookies", desc: "HttpOnly, Secure, SameSite=Lax — not accessible to JavaScript" },
            { label: "HTTPS enforced", desc: "All traffic is encrypted via TLS" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
