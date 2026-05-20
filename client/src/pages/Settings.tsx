import { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
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
import { UserPlus, Copy, Check, ShieldOff, ShieldCheck, Mail, Users, Trash2, Pencil, Link2, Link2Off, RefreshCw, Calendar, Building2 } from "lucide-react";

// ─── Team Leaders Section ────────────────────────────────────────────────────
function TeamLeadersSection() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const utils = trpc.useUtils();
  const { data: tls, isLoading } = trpc.settings.listTeamLeaders.useQuery();

  const addMutation = trpc.settings.addTeamLeader.useMutation({
    onSuccess: () => {
      utils.settings.listTeamLeaders.invalidate();
      setAddOpen(false);
      setName(""); setEmail(""); setPhone("");
      toast.success("Team leader added");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = trpc.settings.updateTeamLeader.useMutation({
    onSuccess: () => {
      utils.settings.listTeamLeaders.invalidate();
      setEditOpen(false);
      toast.success("Team leader updated");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = trpc.settings.deleteTeamLeader.useMutation({
    onSuccess: () => {
      utils.settings.listTeamLeaders.invalidate();
      toast.success("Team leader removed");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleActiveMutation = trpc.settings.updateTeamLeader.useMutation({
    onSuccess: () => utils.settings.listTeamLeaders.invalidate(),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openEdit = (tl: { id: number; name: string; email?: string | null; phone?: string | null }) => {
    setEditId(tl.id);
    setName(tl.name);
    setEmail(tl.email ?? "");
    setPhone(tl.phone ?? "");
    setEditOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base">Team Leaders</CardTitle>
          <CardDescription className="text-sm mt-0.5">
            Manage the fixed list of TLs available for agent assignment in Operations.
          </CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setName(""); setEmail(""); setPhone(""); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              Add TL
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Leader</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="e.g. Ahmed Hassan" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input type="email" placeholder="ahmed@tanis-eg.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input placeholder="+20 1XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button
                className="w-full"
                onClick={() => addMutation.mutate({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined })}
                disabled={addMutation.isPending || !name.trim()}
              >
                {addMutation.isPending ? "Adding..." : "Add Team Leader"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
        ) : !tls || tls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No team leaders yet. Add your first TL above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tls.map((tl) => (
              <div key={tl.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tl.name}</p>
                  {tl.email && <p className="text-xs text-muted-foreground truncate">{tl.email}</p>}
                  {tl.phone && <p className="text-xs text-muted-foreground">{tl.phone}</p>}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Badge variant={tl.isActive ? "default" : "secondary"} className="text-xs">
                    {tl.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => openEdit(tl)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => toggleActiveMutation.mutate({ id: tl.id, isActive: !tl.isActive })}
                    title={tl.isActive ? "Deactivate" : "Reactivate"}
                  >
                    {tl.isActive
                      ? <ShieldOff className="h-3.5 w-3.5 text-amber-500" />
                      : <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    }
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {tl.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes them from the TL list. Agents already assigned to this TL will keep the assignment text, but the TL won't appear in future dropdowns.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate({ id: tl.id })}
                        >
                          Remove
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Leader</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => editId !== null && updateMutation.mutate({ id: editId, name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined })}
              disabled={updateMutation.isPending || !name.trim()}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────
// ─── Integrations Section ────────────────────────────────────────────────────
function IntegrationsSection() {
  const utils = trpc.useUtils();
  const { data: status, isLoading, refetch } = trpc.integrations.getStatus.useQuery();
  const disconnectGoogle = trpc.integrations.disconnectGoogle.useMutation({
    onSuccess: () => { refetch(); toast.success("Google Calendar disconnected"); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Check for ?google=connected in URL after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      toast.success("Google Calendar connected successfully!");
      refetch();
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleConnectGoogle = () => {
    const origin = window.location.origin;
    window.location.href = `/api/oauth/google?origin=${encodeURIComponent(origin)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integrations</CardTitle>
        <CardDescription>Connect external services to import candidates automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google Calendar */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Import interview candidates from calendar events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.google ? (
              <>
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => disconnectGoogle.mutate()} disabled={disconnectGoogle.isPending}>
                  <Link2Off className="h-4 w-4 mr-1" /> Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle}>
                <Link2 className="h-4 w-4 mr-1" /> Connect
              </Button>
            )}
          </div>
        </div>

        {/* HubSpot */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium">HubSpot CRM</p>
              <p className="text-xs text-muted-foreground">Import contacts from your HubSpot account</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.hubspot ? (
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not configured
              </Badge>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          To import candidates, go to the <strong>Candidates</strong> page and click the <strong>Import</strong> button in the toolbar.
        </p>
      </CardContent>
    </Card>
  );
}

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
      toast.error(getErrorMessage(err));
    },
  });

  const setActiveMutation = trpc.adminAuth.setActive.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Admin status updated");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
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
        <p className="text-muted-foreground text-sm mt-1">Manage admin access, team leaders, and platform settings.</p>
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

      {/* Team Leaders */}
      <TeamLeadersSection />

       {/* Integrations */}
      <IntegrationsSection />

      {/* Security */}
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
