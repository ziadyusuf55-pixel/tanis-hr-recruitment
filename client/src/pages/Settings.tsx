import React, { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
import { trpc } from "@/lib/trpc";
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_SUMMARY } from "@/lib/roleTabs";
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
import { UserPlus, Copy, Check, ShieldOff, ShieldCheck, Mail, Users, Trash2, Pencil, Link2, Link2Off, RefreshCw, Calendar, Building2, Key, Plus, Eye, EyeOff, Ban, Monitor, Smartphone, Tablet, Globe } from "lucide-react";

// ─── Session Logs Section ───────────────────────────────────────────────────
function SessionLogsSection() {
  const utils = trpc.useUtils();
  const { data: sessions = [], isLoading } = trpc.session.list.useQuery();

  const revokeMutation = trpc.session.revoke.useMutation({
    onSuccess: () => { utils.session.list.invalidate(); toast.success("Session revoked"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const DeviceIcon = ({ type }: { type: string | null }) => {
    if (type === "mobile") return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />;
    if (type === "tablet") return <Tablet className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Login History</CardTitle>
        <CardDescription className="mt-1">All Hub logins — IP address, location, device, and browser. Revoke any session to flag it.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No login records yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">Time</th>
                  <th className="text-left py-2 pr-3 font-medium">User</th>
                  <th className="text-left py-2 pr-3 font-medium">IP</th>
                  <th className="text-left py-2 pr-3 font-medium">Location</th>
                  <th className="text-left py-2 pr-3 font-medium">Device</th>
                  <th className="text-left py-2 pr-3 font-medium">Browser / OS</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className={`border-b last:border-0 ${s.revokedAt ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(s.loggedInAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-medium">{s.userName ?? s.userId}</span>
                      {s.userRole && <span className="ml-1 text-muted-foreground">({s.userRole})</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono whitespace-nowrap">{s.ip ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1">
                        <DeviceIcon type={s.deviceType} />
                        <span className="capitalize">{s.deviceType}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {[s.browser, s.os].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {s.revokedAt ? (
                        <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Active</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      {!s.revokedAt && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Revoke session">
                              <Ban className="h-3 w-3 text-amber-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This marks the session as revoked. The user's cookie will remain valid until they log out, but the record will be flagged.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revokeMutation.mutate({ id: s.id })}
                                className="bg-amber-500 hover:bg-amber-600"
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── API Keys Section ───────────────────────────────────────────────────────
function ApiKeysSection() {
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<{ rawKey: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();
  const { data: keys = [], isLoading } = trpc.apiKeys.list.useQuery();

  const generateMutation = trpc.apiKeys.generate.useMutation({
    onSuccess: (data) => {
      setNewKey({ rawKey: data.rawKey, name: data.name });
      setCreateOpen(false);
      setKeyName("");
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { utils.apiKeys.list.invalidate(); toast.success("Key revoked"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => { utils.apiKeys.list.invalidate(); toast.success("Key deleted"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleCopy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> API Keys</CardTitle>
            <CardDescription className="mt-1">Generate API keys for programmatic data uploads (e.g. cycle stats via POST /api/upload/cycle-stats).</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Generate Key</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Generate API Key</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Key Name</Label>
                  <Input
                    placeholder="e.g. Vicidial Integration, Automation Script"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">A label to identify what this key is used for.</p>
                </div>
                <Button
                  className="w-full"
                  disabled={!keyName.trim() || generateMutation.isPending}
                  onClick={() => generateMutation.mutate({ name: keyName.trim() })}
                >
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : keys.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No API keys yet. Generate one to enable programmatic uploads.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  k.revokedAt ? "opacity-50 bg-muted/30" : "bg-card"
                }`}>
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}... · Created by {k.createdBy}</p>
                    {k.revokedAt && <Badge variant="destructive" className="text-xs mt-0.5">Revoked</Badge>}
                    {k.lastUsedAt && !k.revokedAt && (
                      <p className="text-xs text-muted-foreground">Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!k.revokedAt && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Revoke key">
                            <Ban className="h-3.5 w-3.5 text-amber-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke "{k.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>The key will stop working immediately. You can delete it afterwards.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revokeMutation.mutate({ id: k.id })} className="bg-amber-500 hover:bg-amber-600">Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete key">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{k.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>This permanently removes the key record. It cannot be recovered.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: k.id })} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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

      {/* New key reveal dialog */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setNewKey(null)}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">API Key Generated — "{newKey.name}"</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setNewKey(null)}>✕</button>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠️ Copy this key now — it will never be shown again.</p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={newKey.rawKey}
                className="flex-1 text-xs font-mono border rounded-md px-3 py-2 bg-muted"
              />
              <button
                className="shrink-0 border rounded-md px-3 py-2 hover:bg-muted transition-colors"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-xs font-medium">Usage example:</p>
              <code className="text-xs block font-mono text-muted-foreground break-all">
                POST /api/upload/cycle-stats<br/>
                X-API-Key: {newKey.rawKey.slice(0, 20)}...<br/>
                Content-Type: application/json
              </code>
            </div>
            <button
              className="w-full border rounded-md py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setNewKey(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

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
  const [debugResult, setDebugResult] = useState<null | Record<string, unknown>>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const { data: status, isLoading, refetch } = trpc.integrations.getStatus.useQuery();
  const debugCalendar = trpc.integrations.debugCalendar.useMutation({
    onSuccess: (data) => { setDebugResult(data as Record<string, unknown>); setDebugOpen(true); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
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
    <>
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
                <Button variant="outline" size="sm" onClick={() => debugCalendar.mutate()} disabled={debugCalendar.isPending}>
                  {debugCalendar.isPending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Debug
                </Button>
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

    {/* Debug Dialog */}
    <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Google Calendar Debug Info</DialogTitle>
        </DialogHeader>
        {debugResult && (
          <div className="space-y-4 text-sm">
            {debugResult.error ? (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">{String(debugResult.error)}</div>
            ) : (
              <>
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium mb-1">Time Range (Today)</p>
                  <p className="font-mono text-xs">{String(debugResult.timeMin)} → {String(debugResult.timeMax)}</p>
                </div>
                <div>
                  <p className="font-medium mb-2">Calendars Found ({(debugResult.calendars as unknown[]).length})</p>
                  <div className="space-y-1">
                    {(debugResult.calendars as Array<{id: string; summary: string; accessRole: string}>).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded border text-xs">
                        <span className="font-medium">{c.summary}</span>
                        <Badge variant="outline" className="text-xs">{c.accessRole}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium mb-2">Events Today ({(debugResult.sampleEvents as unknown[]).length})</p>
                  {(debugResult.sampleEvents as unknown[]).length === 0 ? (
                    <p className="text-muted-foreground text-xs">No events found today across all calendars.</p>
                  ) : (
                    <div className="space-y-1">
                      {(debugResult.sampleEvents as Array<{calendarName: string; summary: string; start: string; attendeeCount: number; hasPhone: boolean}>).map((ev, i) => (
                        <div key={i} className="p-2 rounded border text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ev.summary}</span>
                            <span className="text-muted-foreground">{ev.calendarName}</span>
                          </div>
                          <div className="flex gap-3 text-muted-foreground">
                            <span>Start: {ev.start ? new Date(ev.start).toLocaleTimeString() : "—"}</span>
                            <span>Attendees: {ev.attendeeCount}</span>
                            <span>Phone in desc: {ev.hasPhone ? "✓ Yes" : "✗ No"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

export default function Settings() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: admins, refetch } = trpc.adminAuth.list.useQuery();

  // Central permissions: Google-login users + their roles
  const utilsRoles = trpc.useUtils();
  const { data: appUsers = [] } = trpc.auth.listAppUsers.useQuery(undefined, { retry: false });
  const setRoleMutation = trpc.auth.setUserRole.useMutation({
    onSuccess: () => { utilsRoles.auth.listAppUsers.invalidate(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });

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

  const [regenToken, setRegenToken] = useState<string | null>(null);
  const [regenAdminId, setRegenAdminId] = useState<number | null>(null);
  const [regenCopied, setRegenCopied] = useState(false);

  const regenerateMutation = trpc.adminAuth.regenerateInvite.useMutation({
    onSuccess: (data) => {
      setRegenToken(data.token);
      refetch();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const regenLink = regenToken
    ? `${window.location.origin}/admin-invite?token=${regenToken}`
    : null;

  const handleRegenCopy = () => {
    if (!regenLink) return;
    navigator.clipboard.writeText(regenLink);
    setRegenCopied(true);
    setTimeout(() => setRegenCopied(false), 2000);
  };

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

      {/* Central permissions — tab-level roles on Google-login users */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Team Roles &amp; Access</CardTitle>
          <CardDescription className="text-sm mt-0.5">
            Control what each person can see. Set a role and everything outside it is hidden and blocked.
            People appear here after their first sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No users yet — they'll show up here after they sign in for the first time.</p>
          ) : (
            <div className="divide-y">
              {appUsers.map((u: { openId: string; name: string | null; email: string | null; role: string }) => (
                <div key={u.openId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || u.email || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(u.role === "user" || u.role === "viewer") && (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">No access</span>
                    )}
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm bg-background"
                      value={u.role}
                      title={ROLE_SUMMARY[u.role] || ""}
                      onChange={(e) => setRoleMutation.mutate({ openId: u.openId, role: e.target.value as typeof ASSIGNABLE_ROLES[number] })}
                    >
                      {(u.role === "user" || u.role === "viewer") && <option value={u.role}>{ROLE_LABELS[u.role]}</option>}
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t space-y-1">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">What each role can open</p>
            {ASSIGNABLE_ROLES.map((r) => (
              <p key={r} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{ROLE_LABELS[r]}</span> — {ROLE_SUMMARY[r]}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <ManagementCard />

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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Regenerate invite link"
                      disabled={regenerateMutation.isPending && regenAdminId === admin.id}
                      onClick={() => {
                        setRegenAdminId(admin.id);
                        setRegenToken(null);
                        regenerateMutation.mutate({ id: admin.id });
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
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

      {/* Regenerated invite link dialog */}
      {regenToken && regenLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setRegenToken(null); setRegenAdminId(null); }}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">New Invite Link Generated</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => { setRegenToken(null); setRegenAdminId(null); }}>✕</button>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">This link replaces the previous one. The old link is now invalid. Share this new link — it expires in 48 hours.</p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={regenLink}
                className="flex-1 text-xs font-mono border rounded-md px-3 py-2 bg-muted"
              />
              <button
                className="shrink-0 border rounded-md px-3 py-2 hover:bg-muted transition-colors"
                onClick={handleRegenCopy}
              >
                {regenCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              className="w-full border rounded-md py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => { setRegenToken(null); setRegenAdminId(null); }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Team Leaders */}
      <TeamLeadersSection />

       {/* Integrations */}
      <IntegrationsSection />

      {/* API Keys */}
      <ApiKeysSection />

      {/* Login History */}
      <SessionLogsSection />

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

// ── Management — create employee records for managers/TLs/HR and link their logins ──
// Once linked, that person can edit their own details in "My Profile", and they
// appear in Employee Profiles alongside agents.
function ManagementCard() {
  const utils = trpc.useUtils();
  const { data: staff = [] } = trpc.employees.list.useQuery({});
  const { data: appUsers = [] } = trpc.auth.listAppUsers.useQuery(undefined, { retry: false });

  const add = trpc.employees.addManagement.useMutation({
    onSuccess: () => { utils.employees.list.invalidate(); toast.success("Employee added"); setForm({ fullName: "", email: "", phone: "", jobTitle: "", employeeType: "manager" }); },
    onError: (e) => toast.error(e.message),
  });
  const link = trpc.employees.linkLogin.useMutation({
    onSuccess: () => { utils.employees.list.invalidate(); toast.success("Login linked"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", jobTitle: "", employeeType: "manager" });

  type Emp = { traineeCode: string; fullName: string | null; alias: string | null; email: string | null; jobTitle: string | null; employeeType: string; openId: string | null };
  const management = (staff as Emp[]).filter(e => e.employeeType && e.employeeType !== "agent");

  const TYPES = ["manager", "team_lead", "hr", "ops_manager", "finance", "admin"];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Management</CardTitle>
        <CardDescription className="text-sm mt-0.5">
          Add managers and team leads as employees, then link their Hub login so they can edit their own profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2 items-end">
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Full name</p>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ahmed Hassan" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@tanis-eg.com" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Job title</p>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Ops Manager" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Type</p>
            <select className="border rounded-md px-2 py-2 text-sm bg-background w-full"
              value={form.employeeType} onChange={(e) => setForm({ ...form, employeeType: e.target.value })}>
              {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        <Button size="sm" disabled={!form.fullName || add.isPending}
          onClick={() => add.mutate({
            fullName: form.fullName,
            email: form.email || undefined,
            jobTitle: form.jobTitle || undefined,
            employeeType: form.employeeType as "manager",
          })}>
          {add.isPending ? "Adding…" : "Add employee"}
        </Button>

        {management.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No management records yet.</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {management.map((e) => (
              <div key={e.traineeCode} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.fullName || e.alias}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.jobTitle || e.employeeType.replace(/_/g, " ")}{e.email ? ` · ${e.email}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {e.openId ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Login linked</span>
                  ) : (
                    <select
                      className="border rounded-md px-2 py-1.5 text-xs bg-background"
                      defaultValue=""
                      onChange={(ev) => { if (ev.target.value) link.mutate({ traineeCode: e.traineeCode, openId: ev.target.value }); }}
                    >
                      <option value="">Link a login…</option>
                      {(appUsers as { openId: string; name: string | null; email: string | null }[]).map(u => (
                        <option key={u.openId} value={u.openId}>{u.name || u.email}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          They must sign in to the Hub once before they appear in the "Link a login" list.
        </p>
      </CardContent>
    </Card>
  );
}
