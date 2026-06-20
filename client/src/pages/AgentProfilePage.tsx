import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, User, FileText, CreditCard, MessageSquare,
  Plus, Trash2, ExternalLink, CheckCircle2, AlertTriangle, Info,
  Star, Building2, Phone, Mail, Calendar, Clock, Shield,
  LogOut, XCircle, KeyRound, MoreVertical, Pencil, GraduationCap, History,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const BRAND = "#8B1A1A";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "documents" | "payment" | "comments" | "coaching" | "history";

const TAG_CONFIG = {
  note:     { label: "Note",     icon: Info,          color: "bg-blue-100 text-blue-700 border-blue-200" },
  warning:  { label: "Warning",  icon: AlertTriangle,  color: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", icon: CheckCircle2,  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id: "National ID",
  certificate: "Certificate",
  cv: "CV / Resume",
  contract: "Contract",
  photo: "Photo",
  other: "Other",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  wallet: "Mobile Wallet",
  bank: "Bank Transfer",
};

const WALLET_PROVIDER_LABELS: Record<string, string> = {
  vodafone_cash: "Vodafone Cash",
  orange_cash: "Orange Cash",
};

export default function AgentProfilePage() {
  const params = useParams<{ code: string }>();
  const traineeCode = params.code ?? "";
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  // Data
  const { data: profile, isLoading, refetch } = trpc.workforce.getAgentFullProfile.useQuery(
    { traineeCode },
    { enabled: !!traineeCode }
  );
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();
  const { data: teamLeaders = [] } = trpc.settings.listTeamLeaders.useQuery();
  const utils = trpc.useUtils();
  const { data: pendingSep } = trpc.separation.getPendingForAgent.useQuery({ agentCode: traineeCode }, { enabled: !!traineeCode });

  // ── Separation dialogs ────────────────────────────────────────────────────
  const [separationDialog, setSeparationDialog] = useState<"resign" | "terminate" | null>(null);
  const [separationReason, setSeparationReason] = useState("");
  const [separationEffectiveDate, setSeparationEffectiveDate] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [resetPwDialog, setResetPwDialog] = useState(false);
  const [newPwResult, setNewPwResult] = useState<string | null>(null);

  const resignOnSpot = trpc.separation.resignOnSpot.useMutation({
    onSuccess: () => {
      toast.success("Agent marked as resigned and removed from system");
      setSeparationDialog(null);
      setSeparationReason("");
      utils.workforce.list.invalidate();
      navigate("/operations");
    },
    onError: (e) => toast.error(e.message),
  });

  const terminateAgent = trpc.separation.terminate.useMutation({
    onSuccess: () => {
      toast.success("Agent terminated and removed from system");
      setSeparationDialog(null);
      setSeparationReason("");
      utils.workforce.list.invalidate();
      navigate("/operations");
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduleResignationMut = trpc.separation.scheduleResignation.useMutation({
    onSuccess: () => {
      toast.success("Resignation scheduled — agent stays active until the effective date");
      setSeparationDialog(null); setSeparationReason(""); setSeparationEffectiveDate("");
      utils.separation.getPendingForAgent.invalidate({ agentCode: traineeCode });
      utils.workforce.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelScheduledMut = trpc.separation.cancelScheduled.useMutation({
    onSuccess: () => {
      toast.success("Scheduled resignation cancelled");
      utils.separation.getPendingForAgent.invalidate({ agentCode: traineeCode });
      utils.workforce.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const forceDelete = trpc.workforce.forceDelete.useMutation({
    onSuccess: () => {
      toast.success("Agent and candidate record permanently deleted");
      setDeleteDialog(false);
      utils.workforce.list.invalidate();
      navigate("/operations");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPassword = trpc.agent.resetPassword.useMutation({
    onSuccess: (data) => {
      setNewPwResult(data.password);
      setResetPwDialog(true);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Edit Info ─────────────────────────────────────────────────────────────
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<{
    teamLeader: string; nestingStatus: "nesting" | "active" | "senior"; shiftHours: string;
  }>({ teamLeader: "", nestingStatus: "active", shiftHours: "" });

  const updateAgent = trpc.workforce.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Agent info updated"); setEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  function openEditInfo() {
    if (!profile) return;
    setEditForm({
      teamLeader: profile.agent?.teamLeader ?? "",
      nestingStatus: ((profile.agent as any)?.nestingStatus as "nesting" | "active" | "senior") ?? "active",
      shiftHours: profile.agent?.shiftHours ?? "",
    });
    setEditDialog(true);
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  const [commentDialog, setCommentDialog] = useState(false);
  const [commentForm, setCommentForm] = useState({ content: "", tag: "note" as "note" | "warning" | "resolved" });
  const addComment = trpc.agentComments.add.useMutation({
    onSuccess: () => { refetch(); toast.success("Comment added"); setCommentDialog(false); setCommentForm({ content: "", tag: "note" }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteComment = trpc.agentComments.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Comment deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Payment Methods ───────────────────────────────────────────────────────
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState<{
    id?: number; type: "wallet" | "bank";
    walletProvider?: "vodafone_cash" | "orange_cash"; walletPhone?: string; walletName?: string;
    bankName?: string; bankAccountOrPhone?: string; bankFullName?: string; isPreferred?: boolean;
  }>({ type: "wallet" });
  const upsertPayment = trpc.paymentMethods.adminUpsert.useMutation({
    onSuccess: () => { refetch(); toast.success("Payment method saved"); setPayDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deletePayment = trpc.paymentMethods.adminDelete.useMutation({
    onSuccess: () => { refetch(); toast.success("Payment method deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const setPreferred = trpc.paymentMethods.adminSetPreferred.useMutation({
    onSuccess: () => { refetch(); toast.success("Preferred payment updated"); },
    onError: (e) => toast.error(e.message),
  });

  function openAddPayment() { setPayForm({ type: "wallet" }); setPayDialog(true); }
  function openEditPayment(pm: NonNullable<typeof profile>["paymentMethods"][number]) {
    setPayForm({
      id: pm.id, type: pm.type,
      walletProvider: pm.walletProvider ?? undefined,
      walletPhone: pm.walletPhone ?? undefined,
      walletName: pm.walletName ?? undefined,
      bankName: pm.bankName ?? undefined,
      bankAccountOrPhone: pm.bankAccountOrPhone ?? undefined,
      bankFullName: pm.bankFullName ?? undefined,
      isPreferred: pm.isPreferred,
    });
    setPayDialog(true);
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Agent not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/operations")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Operations
        </Button>
      </div>
    );
  }

  const { agent, documents, paymentMethods, comments } = profile;
  const campaign = (campaigns as Array<{id: number; name: string}>).find(c => c.id === agent.campaignId);
  const offDays = [agent.offDay1, agent.offDay2].filter(d => d !== null && d !== undefined) as number[];
  const isActive = agent.agentStatus === "active" || agent.isActive;
  const nestingStatus = (agent as any).nestingStatus as string | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/operations")}>
        <ArrowLeft className="h-4 w-4" /> Back to Operations
      </Button>

      {/* Profile Header Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
              style={{ background: BRAND }}>
              {agent.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{agent.fullName}</h1>
                {agent.alias && <span className="text-muted-foreground text-sm">({agent.alias})</span>}
                {agent.agentStatus === "resigned" ? (
                  <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Resigned</Badge>
                ) : agent.agentStatus === "terminated" ? (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline">Terminated</Badge>
                ) : agent.isActive ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {pendingSep && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Leaving {pendingSep.lastWorkingDay ?? ""}</Badge>
                )}
                {nestingStatus === "senior" && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200" variant="outline">Senior</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{agent.traineeCode}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {campaign && (
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{campaign.name}</span>
                )}
                {agent.shiftHours && (
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{agent.shiftHours}</span>
                )}
                {agent.teamLeader && (
                  <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />TL: {agent.teamLeader}</span>
                )}
                {agent.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{agent.phone}</span>
                )}
                {agent.email && (
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{agent.email}</span>
                )}
                {offDays.length > 0 && (
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Off: {offDays.map(d => DAY_NAMES[d]).join(", ")}</span>
                )}
                {agent.joinDate && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Joined {new Date(agent.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Edit Info */}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditInfo}>
                <Pencil className="h-3.5 w-3.5" /> Edit Info
              </Button>
              {/* Reset Password */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => resetPassword.mutate({ candidateId: agent.candidateId, traineeCode: agent.traineeCode ?? undefined, crdts: agent.crdts ?? undefined })}
                disabled={resetPassword.isPending}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {resetPassword.isPending ? "Resetting…" : "Reset Password"}
              </Button>
              {/* More actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <MoreVertical className="h-4 w-4" /> Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {isActive && (
                    <>
                      <DropdownMenuItem
                        className="gap-2 text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                        onClick={() => { setSeparationReason(""); setSeparationDialog("resign"); }}
                      >
                        <LogOut className="h-4 w-4" /> Mark as Resigned
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-red-700 focus:text-red-700 focus:bg-red-50"
                        onClick={() => { setSeparationReason(""); setSeparationDialog("terminate"); }}
                      >
                        <XCircle className="h-4 w-4" /> Terminate Agent
                      </DropdownMenuItem>
                      {pendingSep && (
                        <DropdownMenuItem
                          className="gap-2 text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                          onClick={() => cancelScheduledMut.mutate({ agentCode: traineeCode })}
                        >
                          <LogOut className="h-4 w-4" /> Cancel scheduled resignation
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => setDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Force Delete (Permanent)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information (HR profile) */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>
            {agent.profileLocked
              ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">🔒 Submitted by agent</span>
              : <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Awaiting agent</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            {([
              ["National ID", agent.nationalId],
              ["ID Expiry", agent.nationalIdExpiry],
              ["Date of Birth", agent.dateOfBirth],
              ["Age", agent.dateOfBirth ? Math.floor((Date.now() - new Date(agent.dateOfBirth).getTime()) / 31557600000) + " yrs" : ""],
              ["Gender", agent.gender ? agent.gender.charAt(0).toUpperCase() + agent.gender.slice(1) : ""],
              ["Nationality", agent.nationality],
              ["Marital Status", agent.maritalStatus ? agent.maritalStatus.charAt(0).toUpperCase() + agent.maritalStatus.slice(1) : ""],
              ["Military Status", agent.militaryStatus ? agent.militaryStatus.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : ""],
              ["Job Title", agent.jobTitle],
              ["City", agent.city],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                <p className="font-medium text-foreground">{value || "—"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {([
          { id: "documents", label: "Documents", icon: FileText, count: documents.length },
          { id: "payment",   label: "Payment Preferences", icon: CreditCard, count: paymentMethods.length },
          { id: "comments",  label: "Comments / Issues", icon: MessageSquare, count: comments.length },
          { id: "coaching",  label: "Coaching", icon: GraduationCap, count: 0 },
          { id: "history",   label: "History",  icon: History, count: 0 },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-[#8B1A1A] text-[#8B1A1A]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeTab === tab.id ? "bg-[#8B1A1A]/10 text-[#8B1A1A]" : "bg-muted text-muted-foreground"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Documents Tab ─────────────────────────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents uploaded yet.</p>
            </div>
          ) : (
            documents.map(doc => (
              <Card key={doc.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</p>
                    {doc.adminComment && <p className="text-xs text-muted-foreground mt-0.5">{doc.adminComment}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Payment Tab ───────────────────────────────────────────────────── */}
      {activeTab === "payment" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 text-white" style={{ background: BRAND }} onClick={openAddPayment}>
              <Plus className="h-4 w-4" /> Add Payment Method
            </Button>
          </div>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payment methods added yet.</p>
            </div>
          ) : (
            paymentMethods.map(pm => (
              <Card key={pm.id} className={`border shadow-sm ${pm.isPreferred ? "border-[#8B1A1A]/30 bg-[#8B1A1A]/5" : ""}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{PAYMENT_TYPE_LABELS[pm.type]}</p>
                      {pm.isPreferred && <Badge className="text-xs bg-[#8B1A1A]/10 text-[#8B1A1A] border-[#8B1A1A]/20" variant="outline"><Star className="h-2.5 w-2.5 mr-1" />Preferred</Badge>}
                    </div>
                    {pm.type === "wallet" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pm.walletProvider ? WALLET_PROVIDER_LABELS[pm.walletProvider] : ""} {pm.walletPhone && `· ${pm.walletPhone}`} {pm.walletName && `· ${pm.walletName}`}
                      </p>
                    )}
                    {pm.type === "bank" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pm.bankName} {pm.bankAccountOrPhone && `· ${pm.bankAccountOrPhone}`} {pm.bankFullName && `· ${pm.bankFullName}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!pm.isPreferred && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setPreferred.mutate({ id: pm.id, traineeCode })}>
                        <Star className="h-3.5 w-3.5" /> Set Preferred
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPayment(pm)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePayment.mutate({ id: pm.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Comments Tab ──────────────────────────────────────────────────── */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 text-white" style={{ background: BRAND }} onClick={() => setCommentDialog(true)}>
              <Plus className="h-4 w-4" /> Add Comment
            </Button>
          </div>
          {comments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No comments or issues recorded yet.</p>
            </div>
          ) : (
            comments.map(c => {
              const cfg = TAG_CONFIG[c.tag as keyof typeof TAG_CONFIG] ?? TAG_CONFIG.note;
              const CfgIcon = cfg.icon;
              return (
                <Card key={c.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                        <CfgIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${cfg.color}`} variant="outline">{cfg.label}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm">{c.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => deleteComment.mutate({ id: c.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Coaching Tab ──────────────────────────────────────────────────── */}
      {activeTab === "coaching" && (
        <CoachingTab crdts={agent.crdts ?? ""} navigate={navigate} />
      )}

      {/* ── History Tab ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <AgentHistoryTab crdts={agent.crdts ?? ""} />
      )}

      {/* ── Edit Info Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" style={{ color: BRAND }} /> Edit Agent Info
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Team Leader</Label>
              <Select value={editForm.teamLeader || "none"} onValueChange={v => setEditForm(f => ({ ...f, teamLeader: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select TL..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No TL assigned</SelectItem>
                  {(teamLeaders as Array<{id: number; name: string}>).map(tl => (
                    <SelectItem key={tl.id} value={tl.name}>{tl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Shift Hours</Label>
              <Input placeholder="e.g. 9:00 AM - 5:00 PM" value={editForm.shiftHours} onChange={e => setEditForm(f => ({ ...f, shiftHours: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button
              disabled={updateAgent.isPending}
              className="text-white"
              style={{ background: BRAND }}
              onClick={() => updateAgent.mutate({
                traineeCode,
                teamLeader: editForm.teamLeader || undefined,
                nestingStatus: editForm.nestingStatus,
                shiftHours: editForm.shiftHours || undefined,
              })}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Separation Dialog (Resign / Terminate) ────────────────────────── */}
      <Dialog open={!!separationDialog} onOpenChange={(open) => { if (!open) setSeparationDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${separationDialog === "terminate" ? "text-red-700" : "text-amber-700"}`}>
              {separationDialog === "terminate" ? <XCircle className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              {separationDialog === "terminate" ? "Terminate Agent" : "Mark as Resigned"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${separationDialog === "terminate" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {separationDialog === "terminate"
                ? `This will terminate ${agent.fullName} (${traineeCode}). Their ID will be permanently retired and cannot be reassigned.`
                : `This will mark ${agent.fullName} (${traineeCode}) as resigned. Their ID will be permanently retired and cannot be reassigned.`
              }
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder={separationDialog === "terminate" ? "Reason for termination…" : "Reason for resignation…"}
                rows={3}
                value={separationReason}
                onChange={e => setSeparationReason(e.target.value)}
              />
            </div>
            {separationDialog === "resign" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Effective date <span className="text-muted-foreground">(optional — blank = immediate)</span>
                </label>
                <input type="date" value={separationEffectiveDate}
                  onChange={e => setSeparationEffectiveDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
                <p className="text-[11px] text-muted-foreground mt-1">If set, the agent stays active, can log in, and counts in headcount until this date — then is deactivated automatically and their CRDTS is freed.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSeparationDialog(null)}>Cancel</Button>
            <Button
              disabled={!separationReason.trim() || resignOnSpot.isPending || terminateAgent.isPending || scheduleResignationMut.isPending}
              className={separationDialog === "terminate" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
              onClick={() => {
                if (!separationReason.trim()) return;
                if (separationDialog === "resign") {
                  if (separationEffectiveDate) {
                    scheduleResignationMut.mutate({ agentCode: traineeCode, effectiveDate: separationEffectiveDate, reason: separationReason.trim() });
                  } else {
                    resignOnSpot.mutate({ agentCode: traineeCode, reason: separationReason.trim() });
                  }
                } else {
                  terminateAgent.mutate({ agentCode: traineeCode, reason: separationReason.trim() });
                }
              }}
            >
              {separationDialog === "terminate" ? "Confirm Termination" : "Confirm Resignation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Force Delete Confirmation Dialog ──────────────────────────────── */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Permanently Delete Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-lg border bg-red-50 border-red-200 text-sm text-red-800">
              <strong>This cannot be undone.</strong> The agent <strong>{agent.fullName}</strong> ({traineeCode}) and their candidate record will be permanently deleted from the system, including all documents, comments, payment methods, and credentials.
            </div>
            <p className="text-sm text-muted-foreground">Use this only for test data or duplicate entries. For real separations, use Resign or Terminate instead.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={forceDelete.isPending}
              onClick={() => forceDelete.mutate({ traineeCode })}
            >
              {forceDelete.isPending ? "Deleting…" : "Delete Permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Result Dialog ──────────────────────────────────── */}
      <Dialog open={resetPwDialog} onOpenChange={(open) => { if (!open) { setResetPwDialog(false); setNewPwResult(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <KeyRound className="h-5 w-5" /> Password Reset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">New temporary password for <strong>{agent.fullName}</strong>. Share this once — it will not be shown again.</p>
            {newPwResult && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <code className="flex-1 text-sm font-mono font-bold text-amber-900">{newPwResult}</code>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(newPwResult); toast.success("Copied"); }}>
                  Copy
                </Button>
              </div>
            )}
            <p className="text-xs text-amber-700">The agent will be required to change this password on next login.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => { setResetPwDialog(false); setNewPwResult(null); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Comment Dialog ─────────────────────────────────────────────── */}
      <Dialog open={commentDialog} onOpenChange={setCommentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" style={{ color: BRAND }} /> Add Comment / Issue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tag</label>
              <div className="flex gap-2">
                {(["note", "warning", "resolved"] as const).map(tag => {
                  const cfg = TAG_CONFIG[tag];
                  const TagIcon = cfg.icon;
                  return (
                    <button
                      key={tag}
                      onClick={() => setCommentForm(f => ({ ...f, tag }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                        commentForm.tag === tag ? cfg.color + " ring-2 ring-offset-1" : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <TagIcon className="h-3.5 w-3.5" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comment</label>
              <Textarea
                placeholder="Describe the issue or note..."
                rows={4}
                value={commentForm.content}
                onChange={e => setCommentForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCommentDialog(false)}>Cancel</Button>
            <Button
              disabled={!commentForm.content.trim() || addComment.isPending}
              className="text-white"
              style={{ background: BRAND }}
              onClick={() => addComment.mutate({ traineeCode, content: commentForm.content.trim(), tag: commentForm.tag })}
            >
              Add Comment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" style={{ color: BRAND }} />
              {payForm.id ? "Edit" : "Add"} Payment Method
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <div className="flex gap-2">
                {(["wallet", "bank"] as const).map(t => (
                  <button key={t} onClick={() => setPayForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${payForm.type === t ? "border-[#8B1A1A] bg-[#8B1A1A]/5 text-[#8B1A1A]" : "border-border text-muted-foreground"}`}>
                    {PAYMENT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            {payForm.type === "wallet" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={payForm.walletProvider ?? ""} onChange={e => setPayForm(f => ({ ...f, walletProvider: e.target.value as "vodafone_cash" | "orange_cash" || undefined }))}>
                    <option value="">Select provider...</option>
                    <option value="vodafone_cash">Vodafone Cash</option>
                    <option value="orange_cash">Orange Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
                  <Input placeholder="01XXXXXXXXX" value={payForm.walletPhone ?? ""} onChange={e => setPayForm(f => ({ ...f, walletPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name</label>
                  <Input placeholder="Full name on account" value={payForm.walletName ?? ""} onChange={e => setPayForm(f => ({ ...f, walletName: e.target.value }))} />
                </div>
              </>
            )}
            {payForm.type === "bank" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Name</label>
                  <Input placeholder="e.g. CIB, NBE, Banque Misr" value={payForm.bankName ?? ""} onChange={e => setPayForm(f => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Number or Phone</label>
                  <Input placeholder="Account number or registered phone" value={payForm.bankAccountOrPhone ?? ""} onChange={e => setPayForm(f => ({ ...f, bankAccountOrPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Holder Name</label>
                  <Input placeholder="Full name as on bank account" value={payForm.bankFullName ?? ""} onChange={e => setPayForm(f => ({ ...f, bankFullName: e.target.value }))} />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPreferred" checked={!!payForm.isPreferred}
                onChange={e => setPayForm(f => ({ ...f, isPreferred: e.target.checked }))} className="rounded" />
              <label htmlFor="isPreferred" className="text-sm">Set as preferred payment method</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPayDialog(false)}>Cancel</Button>
            <Button
              disabled={upsertPayment.isPending}
              className="text-white"
              style={{ background: BRAND }}
              onClick={() => upsertPayment.mutate({ ...payForm, traineeCode })}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CoachingTab ─────────────────────────────────────────────────────────────

function CoachingTab({ crdts, navigate }: { crdts: string; navigate: (path: string) => void }) {
  const { data: sessions = [], isLoading } = trpc.coaching.listByCrdts.useQuery(
    { crdts },
    { enabled: !!crdts }
  );

  const STATUS_COLORS: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending:  "bg-amber-100 text-amber-700 border-amber-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const totalApproved = sessions
    .filter(s => s.status === "approved")
    .reduce((sum, s) => sum + parseFloat(String(s.bonusAmount ?? 0)), 0);

  return (
    <div className="space-y-4">
      {/* Quick link to Quality Log filtered by this agent */}
      {crdts && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
          <Star className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Quality Scorecard</p>
            <p className="text-xs text-muted-foreground">View all quality log entries for this agent</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => navigate(`/quality?crdts=${encodeURIComponent(crdts)}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Quality Log
          </Button>
        </div>
      )}

      {/* Coaching sessions summary */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <GraduationCap className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            <strong>{sessions.filter(s => s.status === "approved").length}</strong> approved session{sessions.filter(s => s.status === "approved").length !== 1 ? "s" : ""} ·{" "}
            Total bonus: <strong>${totalApproved.toFixed(2)}</strong>
          </p>
        </div>
      )}

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No coaching sessions recorded for this agent.</p>
          <p className="text-xs mt-1">Upload coaching data in the Cycle Tracker to see sessions here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Card key={s.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{s.sessionDate}</p>
                      {s.sessionType && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-medium">{s.sessionType}</span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[s.status ?? "pending"]}`}>
                        {s.status ?? "pending"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{s.coachingHours}h coaching</span>
                      <span className="font-medium text-emerald-700">${parseFloat(String(s.bonusAmount ?? 0)).toFixed(2)} bonus</span>
                      <span>Cycle: {s.cycleKey}</span>
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AgentHistoryTab ──────────────────────────────────────────────────────────

function AgentHistoryTab({ crdts }: { crdts: string }) {
  const { data: cycleHistory = [], isLoading: loadingCycles } = trpc.cycleTracker.getAgentHistory.useQuery(
    { crdts },
    { enabled: !!crdts }
  );
  const { data: payrollHistory = [], isLoading: loadingPayroll } = trpc.payrollV2.getAgentPayrollHistory.useQuery(
    { crdts },
    { enabled: !!crdts }
  );

  function formatMonth(m: string) {
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
  }

  function fmtUSD(v: number) { return v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"; }
  function fmtEGP(v: string | number | null | undefined) {
    if (!v) return "—";
    const n = typeof v === "number" ? v : parseFloat(v as string);
    return isNaN(n) || n === 0 ? "—" : `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  const isLoading = loadingCycles || loadingPayroll;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
      </div>
    );
  }

  const hasCycles = cycleHistory.length > 0;
  const hasPayroll = payrollHistory.length > 0;

  if (!hasCycles && !hasPayroll) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No historical data found for this agent.</p>
        <p className="text-xs mt-1">Upload cycle stats or payroll data to see history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Cycle Performance History ── */}
      {hasCycles && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4" style={{ color: BRAND }} />
            <h3 className="text-sm font-semibold">Cycle Performance History</h3>
            <span className="text-xs text-muted-foreground">({cycleHistory.length} cycles)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cycle</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Calls</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Login Hrs</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rev/Hr</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Profit</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Deductions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">OT Hrs</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Days</th>
                </tr>
              </thead>
              <tbody>
                {cycleHistory.map((c, i) => (
                  <tr key={c.cycleKey} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 font-medium">{formatMonth(c.cycleKey)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.dateRange.start} → {c.dateRange.end}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-700">{fmtUSD(c.totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right">{c.totalCalls > 0 ? c.totalCalls.toLocaleString() : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{c.totalLoginHours > 0 ? c.totalLoginHours.toFixed(1) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{c.revPerHr > 0 ? `$${c.revPerHr.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{fmtUSD(c.totalProfit)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{c.totalDeductions > 0 ? `$${c.totalDeductions.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{c.totalOTHours > 0 ? c.totalOTHours.toFixed(1) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{c.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payroll History ── */}
      {hasPayroll && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4" style={{ color: BRAND }} />
            <h3 className="text-sm font-semibold">Payroll History</h3>
            <span className="text-xs text-muted-foreground">({payrollHistory.length} months)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Month</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Base</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Commission</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">OT 1.5×</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">OT 2×</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">OT 3×</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Deductions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Net Pay</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollHistory.map((p, i) => (
                  <tr key={p.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 font-medium">{formatMonth(p.month)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtEGP(p.baseSalary)}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">{fmtEGP(p.commissionEgp)}</td>
                    <td className="px-4 py-2.5 text-right">{p.ot1x5Hours && parseFloat(String(p.ot1x5Hours)) > 0 ? `${parseFloat(String(p.ot1x5Hours)).toFixed(1)}h` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{p.ot2xHours && parseFloat(String(p.ot2xHours)) > 0 ? `${parseFloat(String(p.ot2xHours)).toFixed(1)}h` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{p.ot3xHours && parseFloat(String(p.ot3xHours)) > 0 ? `${parseFloat(String(p.ot3xHours)).toFixed(1)}h` : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{fmtEGP(p.totalDeductions)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtEGP(p.netPay)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.paymentStatus === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {p.paymentStatus === "paid" ? "✓ Paid" : "⏳ Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
