import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, User, FileText, CreditCard, MessageSquare,
  Plus, Trash2, ExternalLink, CheckCircle2, AlertTriangle, Info,
  Star, Building2, Phone, Mail, Calendar, Clock, Shield,
} from "lucide-react";
import { toast } from "sonner";

const BRAND = "#8B1A1A";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "documents" | "payment" | "comments";

const TAG_CONFIG = {
  note:     { label: "Note",     icon: Info,         color: "bg-blue-100 text-blue-700 border-blue-200" },
  warning:  { label: "Warning",  icon: AlertTriangle, color: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
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

  const utils = trpc.useUtils();

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

  function openAddPayment() {
    setPayForm({ type: "wallet" });
    setPayDialog(true);
  }
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
                <Badge variant={agent.isActive ? "default" : "secondary"} className={agent.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{agent.traineeCode}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {campaign && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {campaign.name}
                  </span>
                )}
                {agent.shiftHours && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {agent.shiftHours}
                  </span>
                )}
                {agent.teamLeader && (
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    TL: {agent.teamLeader}
                  </span>
                )}
                {agent.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {agent.phone}
                  </span>
                )}
                {agent.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {agent.email}
                  </span>
                )}
                {offDays.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Off: {offDays.map(d => DAY_NAMES[d]).join(", ")}
                  </span>
                )}
                {agent.joinDate && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Joined {new Date(agent.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {([
          { id: "documents", label: "Documents", icon: FileText, count: documents.length },
          { id: "payment",   label: "Payment Preferences", icon: CreditCard, count: paymentMethods.length },
          { id: "comments",  label: "Comments / Issues", icon: MessageSquare, count: comments.length },
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
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeTab === tab.id ? "bg-[#8B1A1A]/10 text-[#8B1A1A]" : "bg-muted text-muted-foreground"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Documents Tab ──────────────────────────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No documents uploaded yet</p>
              <p className="text-sm mt-1">The agent hasn't uploaded any documents from their portal.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} className="border shadow-none">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.fileName ?? "Unnamed file"}</p>
                    {doc.adminComment && (
                      <p className="text-xs text-amber-600 mt-0.5">Note: {doc.adminComment}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        doc.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        doc.status === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </Badge>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Payment Tab ────────────────────────────────────────────────────── */}
      {activeTab === "payment" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button className="gap-1.5 text-white" style={{ background: BRAND }} onClick={openAddPayment}>
              <Plus className="h-4 w-4" /> Add Payment Method
            </Button>
          </div>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No payment methods on file</p>
              <p className="text-sm mt-1">Add a payment method to enable salary transfers.</p>
            </div>
          ) : (
            paymentMethods.map((pm) => (
              <Card key={pm.id} className={`border shadow-none ${pm.isPreferred ? "ring-2 ring-[#8B1A1A]/30" : ""}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{PAYMENT_TYPE_LABELS[pm.type]}</p>
                      {pm.isPreferred && (
                        <Badge className="bg-[#8B1A1A]/10 text-[#8B1A1A] border-[#8B1A1A]/20 text-xs">
                          <Star className="h-3 w-3 mr-1" /> Preferred
                        </Badge>
                      )}
                    </div>
                    {pm.type === "wallet" && (
                      <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                        {pm.walletProvider && <p>{WALLET_PROVIDER_LABELS[pm.walletProvider] ?? pm.walletProvider}</p>}
                        {pm.walletPhone && <p>📱 {pm.walletPhone}</p>}
                        {pm.walletName && <p>👤 {pm.walletName}</p>}
                      </div>
                    )}
                    {pm.type === "bank" && (
                      <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                        {pm.bankName && <p>🏦 {pm.bankName}</p>}
                        {pm.bankAccountOrPhone && <p>🔢 {pm.bankAccountOrPhone}</p>}
                        {pm.bankFullName && <p>👤 {pm.bankFullName}</p>}
                      </div>
                    )}
                    {pm.adminComment && (
                      <p className="text-xs text-amber-600 mt-1 italic">{pm.adminComment}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!pm.isPreferred && (
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setPreferred.mutate({ id: pm.id, traineeCode })}>
                        Set Preferred
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPayment(pm)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Delete this payment method?")) deletePayment.mutate({ id: pm.id }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Comments Tab ───────────────────────────────────────────────────── */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button className="gap-1.5 text-white" style={{ background: BRAND }} onClick={() => setCommentDialog(true)}>
              <Plus className="h-4 w-4" /> Add Comment
            </Button>
          </div>
          {comments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No comments yet</p>
              <p className="text-sm mt-1">Add notes or flag issues for this agent. They'll see these in their portal.</p>
            </div>
          ) : (
            comments.map((c) => {
              const tagCfg = TAG_CONFIG[c.tag as keyof typeof TAG_CONFIG] ?? TAG_CONFIG.note;
              const TagIcon = tagCfg.icon;
              return (
                <Card key={c.id} className="border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tagCfg.color}`}>
                            <TagIcon className="h-3 w-3" />
                            {tagCfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">by {c.adminName}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => { if (confirm("Delete this comment?")) deleteComment.mutate({ id: c.id }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

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
