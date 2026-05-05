import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Users,
  Plus,
  Pencil,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Calendar,
  BarChart3,
  Settings,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Agent Detail Panel ──────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  national_id: "National ID (بطاقة الرقم القومي)",
  qualification: "Qualification Certificate (شهادة المؤهل / بيان قيد)",
  cv: "CV",
  personal_photos: "Personal Photos (2–6 صور شخصية)",
  military_status: "Military Status (موقف التجنيد - للذكور)",
  insurance_status: "Insurance Status (موقف التأمينات)",
  criminal_record: "Criminal Record (فيش جنائي)",
};

function AgentDetailDialog({ agent, onClose }: { agent: WorkforceAgent; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: docs = [] } = trpc.documents.listByAgent.useQuery({ traineeCode: agent.traineeCode });
  const { data: allPayments = [] } = trpc.paymentMethods.listAll.useQuery();
  const payments = (allPayments as Array<{ traineeCode?: string } & Record<string, unknown>>).filter(p => p.traineeCode === agent.traineeCode);
  const [activeSection, setActiveSection] = useState<"docs" | "payments">("docs");
  const [docComment, setDocComment] = useState<Record<number, string>>({});
  const [payComment, setPayComment] = useState<Record<number, string>>({});

  const reviewDoc = trpc.documents.review.useMutation({
    onSuccess: () => { utils.documents.listByAgent.invalidate({ traineeCode: agent.traineeCode }); toast.success("Document updated"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const addPaymentComment = trpc.paymentMethods.addComment.useMutation({
    onSuccess: () => { utils.paymentMethods.listAll.invalidate(); toast.success("Comment added"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  type Doc = { id: number; docType: string; fileUrl: string; status: string; adminComment?: string | null; uploadedAt: Date | number | string };
  type Payment = { id: number; method: string; provider?: string | null; accountNumber?: string | null; phoneNumber?: string | null; accountHolderName?: string | null; bankName?: string | null; isPreferred: boolean; adminComment?: string | null; status: string };

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {agent.fullName} {agent.alias ? `(${agent.alias})` : ""} — {agent.traineeCode}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b mb-4">
          {(["docs", "payments"] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSection === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {s === "docs" ? "Documents" : "Payment Methods"}
            </button>
          ))}
        </div>

        {activeSection === "docs" && (
          <div className="space-y-3">
            {(docs as Doc[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet</p>
            ) : (docs as Doc[]).map(doc => (
              <div key={doc.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-sm">{DOC_LABELS[doc.docType] ?? doc.docType}</div>
                    <div className="text-xs text-muted-foreground">{new Date(doc.uploadedAt as number).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${STATUS_COLORS[doc.status] ?? ""}`} variant="outline">{doc.status}</Badge>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  </div>
                </div>
                {doc.adminComment && <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2">Comment: {doc.adminComment}</p>}
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add comment (optional)..."
                    value={docComment[doc.id] ?? ""}
                    onChange={e => setDocComment(c => ({ ...c, [doc.id]: e.target.value }))}
                  />
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => reviewDoc.mutate({ id: doc.id, status: "approved", adminComment: docComment[doc.id] || undefined })} disabled={reviewDoc.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => reviewDoc.mutate({ id: doc.id, status: "rejected", adminComment: docComment[doc.id] || undefined })} disabled={reviewDoc.isPending}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "payments" && (
          <div className="space-y-3">
            {(payments as Payment[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No payment methods added yet</p>
            ) : (payments as Payment[]).map(pay => (
              <div key={pay.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {pay.method === "wallet" ? "Wallet" : "Bank Account"}
                      {pay.provider && <span className="text-xs text-muted-foreground">({pay.provider})</span>}
                      {pay.isPreferred && <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200" variant="outline">Preferred</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {pay.method === "wallet" && pay.phoneNumber && <span>Phone: {pay.phoneNumber}</span>}
                      {pay.method === "bank" && (
                        <span>{pay.bankName}{pay.accountNumber ? ` · Acc: ${pay.accountNumber}` : ""}{pay.phoneNumber ? ` · Phone: ${pay.phoneNumber}` : ""}</span>
                      )}
                      {pay.accountHolderName && <span className="ml-2">Name: {pay.accountHolderName}</span>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[pay.status] ?? ""}`} variant="outline">{pay.status}</Badge>
                </div>
                {pay.adminComment && <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-2">Comment: {pay.adminComment}</p>}
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add comment (optional)..."
                    value={payComment[pay.id] ?? ""}
                    onChange={e => setPayComment(c => ({ ...c, [pay.id]: e.target.value }))}
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => addPaymentComment.mutate({ id: pay.id, comment: payComment[pay.id] || "" })} disabled={addPaymentComment.isPending || !payComment[pay.id]}>Save Comment</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Campaign = {
  id: number;
  name: string;
  minHeadcount: number;
  workDays: "all" | "weekdays";
  notes?: string | null;
};

type WorkforceAgent = {
  id: number;
  traineeCode: string;
  candidateId: number;
  campaignId?: number | null;
  campaignName?: string | null;
  fullName: string;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  shiftHours?: string | null;
  teamLeader?: string | null;
  offDay1?: number | null;
  offDay2?: number | null;
  joinDate?: number | null;
  isActive: boolean;
};

type ForecastDay = {
  date: string;
  dayOfWeek: number;
  scheduled: number;
  approvedLeaves: number;
  projected: number;
};

const EMPTY_CAMPAIGN = { name: "", minHeadcount: "20", workDays: "all" as "all" | "weekdays", notes: "" };

export default function Operations() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"agents" | "campaigns" | "forecast">("agents");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  // Data
  const { data: campaigns = [], isLoading: loadingCampaigns } = trpc.campaigns.list.useQuery();
  const { data: agents = [], isLoading: loadingAgents } = trpc.workforce.list.useQuery({
    campaignId: selectedCampaignId === "all" ? undefined : selectedCampaignId,
  });
  const [forecastCampaignId, setForecastCampaignId] = useState<number | null>(null);
  const { data: forecast = [], isLoading: loadingForecast } = trpc.campaigns.headcountForecast.useQuery(
    { campaignId: forecastCampaignId! },
    { enabled: forecastCampaignId !== null }
  );

  // Campaign CRUD
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign created"); setCampaignDialog(false); setCampaignForm(EMPTY_CAMPAIGN); },
    onError: (e) => toast.error(e.message),
  });
  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign updated"); setCampaignDialog(false); setEditingCampaign(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // Agent edit
  const [editDialog, setEditDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<WorkforceAgent | null>(null);
  type EditForm = {
    fullName?: string; alias?: string; email?: string; phone?: string;
    campaignId?: string; shiftHours?: string; teamLeader?: string;
    offDay1?: string; offDay2?: string; joinDateStr?: string; isActive?: boolean;
  };
  const [editForm, setEditForm] = useState<EditForm>({});
  const updateAgent = trpc.workforce.update.useMutation({
    onSuccess: () => { utils.workforce.list.invalidate(); toast.success("Agent updated"); setEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  // Overtime alert
  const [overtimeDialog, setOvertimeDialog] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeCampaignId, setOvertimeCampaignId] = useState<number | null>(null);
  const [overtimeMessage, setOvertimeMessage] = useState("");
  const sendOvertimeAlert = trpc.campaigns.sendOvertimeAlert.useMutation({
    onSuccess: (data) => { toast.success(`Overtime alert sent to ${data.sent} agents`); setOvertimeDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const filteredAgents = (agents as WorkforceAgent[]).filter(a =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.traineeCode.toLowerCase().includes(search.toLowerCase()) ||
    (a.alias ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openEditAgent = (agent: WorkforceAgent) => {
    setEditingAgent(agent);
    setEditForm({
      fullName: agent.fullName ?? "",
      alias: agent.alias ?? "",
      email: agent.email ?? "",
      phone: agent.phone ?? "",
      campaignId: agent.campaignId?.toString() ?? "",
      shiftHours: agent.shiftHours ?? "",
      teamLeader: agent.teamLeader ?? "",
      offDay1: agent.offDay1?.toString() ?? "",
      offDay2: agent.offDay2?.toString() ?? "",
      joinDateStr: agent.joinDate ? new Date(agent.joinDate).toISOString().slice(0, 10) : "",
      isActive: agent.isActive,
    });
    setEditDialog(true);
  };

  const handleSaveAgent = () => {
    if (!editingAgent) return;
    updateAgent.mutate({
      traineeCode: editingAgent.traineeCode,
      fullName: editForm.fullName || undefined,
      alias: editForm.alias || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      campaignId: editForm.campaignId ? Number(editForm.campaignId) : undefined,
      shiftHours: editForm.shiftHours || undefined,
      teamLeader: editForm.teamLeader || undefined,
      offDay1: editForm.offDay1 !== "" && editForm.offDay1 !== undefined ? Number(editForm.offDay1) : undefined,
      offDay2: editForm.offDay2 !== "" && editForm.offDay2 !== undefined ? Number(editForm.offDay2) : undefined,
      joinDate: editForm.joinDateStr ? new Date(editForm.joinDateStr).getTime() : undefined,
      isActive: editForm.isActive,
    });
  };

  const handleSaveCampaign = () => {
    if (!campaignForm.name.trim()) { toast.error("Campaign name required"); return; }
    if (editingCampaign) {
      updateCampaign.mutate({ id: editingCampaign.id, name: campaignForm.name.trim(), minHeadcount: Number(campaignForm.minHeadcount), workDays: campaignForm.workDays, notes: campaignForm.notes || undefined });
    } else {
      createCampaign.mutate({ name: campaignForm.name.trim(), minHeadcount: Number(campaignForm.minHeadcount), workDays: campaignForm.workDays, notes: campaignForm.notes || undefined });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage active workforce agents, campaigns, and headcount coverage
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => setOvertimeDialog(true)}
          >
            <Bell className="h-4 w-4" /> Overtime Alert
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditingCampaign(null);
              setCampaignForm(EMPTY_CAMPAIGN);
              setCampaignDialog(true);
            }}
          >
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Campaign summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedCampaignId === "all" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"}`}
          onClick={() => setSelectedCampaignId("all")}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">All Campaigns</span>
          </div>
          <div className="text-2xl font-bold">{(agents as WorkforceAgent[]).filter(a => a.isActive).length}</div>
          <div className="text-xs text-muted-foreground">active agents</div>
        </div>
        {(campaigns as Campaign[]).map(c => {
          const count = (agents as WorkforceAgent[]).filter(a => a.campaignId === c.id && a.isActive).length;
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedCampaignId === c.id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"}`}
              onClick={() => setSelectedCampaignId(c.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground truncate">{c.name}</span>
                <button
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground"
                  onClick={e => { e.stopPropagation(); setEditingCampaign(c); setCampaignForm({ name: c.name, minHeadcount: c.minHeadcount.toString(), workDays: c.workDays, notes: c.notes ?? "" }); setCampaignDialog(true); }}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`text-xs font-medium ${count >= c.minHeadcount ? "text-emerald-600" : "text-amber-600"}`}>
                  {count >= c.minHeadcount ? <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> : <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                  min {c.minHeadcount}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[
          { id: "agents", label: "Agents", icon: Users },
          { id: "campaigns", label: "Campaigns", icon: Settings },
          { id: "forecast", label: "Headcount Forecast", icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID, or alias..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="text-sm text-muted-foreground">{filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}</span>
          </div>

          {loadingAgents ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No agents found</p>
              <p className="text-sm mt-1">Transfer agents from Training once they pass mock call</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Campaign</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Shift</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Team Leader</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Off Days</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Join Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAgents.map(agent => (
                    <tr key={agent.traineeCode} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{agent.fullName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{agent.traineeCode}</span>
                          {agent.alias && <span className="text-xs text-muted-foreground">({agent.alias})</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {agent.campaignName ? (
                          <Badge variant="outline" className="text-xs">{agent.campaignName}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{agent.shiftHours ?? "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{agent.teamLeader ?? "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex gap-1">
                          {agent.offDay1 !== null && agent.offDay1 !== undefined && (
                            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">{DAY_NAMES[agent.offDay1]}</span>
                          )}
                          {agent.offDay2 !== null && agent.offDay2 !== undefined && (
                            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">{DAY_NAMES[agent.offDay2]}</span>
                          )}
                          {(agent.offDay1 === null || agent.offDay1 === undefined) && (agent.offDay2 === null || agent.offDay2 === undefined) && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {agent.joinDate ? new Date(agent.joinDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${agent.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}`} variant="outline">
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditAgent(agent)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <div className="space-y-3">
          {loadingCampaigns ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
          ) : (campaigns as Campaign[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Settings className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No campaigns yet</p>
              <Button className="mt-4 gap-1.5" onClick={() => { setEditingCampaign(null); setCampaignForm(EMPTY_CAMPAIGN); setCampaignDialog(true); }}>
                <Plus className="h-4 w-4" /> Create First Campaign
              </Button>
            </div>
          ) : (
            (campaigns as Campaign[]).map(c => {
              const agentCount = (agents as WorkforceAgent[]).filter(a => a.campaignId === c.id && a.isActive).length;
              return (
                <div key={c.id} className="rounded-xl border p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{c.name}</span>
                      <Badge variant="outline" className="text-xs">{c.workDays === "all" ? "7 days" : "Weekdays"}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Min headcount: <strong className="text-foreground">{c.minHeadcount}</strong></span>
                      <span>Active agents: <strong className={agentCount >= c.minHeadcount ? "text-emerald-600" : "text-amber-600"}>{agentCount}</strong></span>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{c.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setForecastCampaignId(c.id); setActiveTab("forecast"); }}
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Forecast
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => { setEditingCampaign(c); setCampaignForm({ name: c.name, minHeadcount: c.minHeadcount.toString(), workDays: c.workDays, notes: c.notes ?? "" }); setCampaignDialog(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) deleteCampaign.mutate({ id: c.id }); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === "forecast" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={forecastCampaignId ?? ""}
              onChange={e => setForecastCampaignId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a campaign...</option>
              {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {forecastCampaignId && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => utils.campaigns.headcountForecast.invalidate({ campaignId: forecastCampaignId })}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            )}
          </div>

          {!forecastCampaignId ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p>Select a campaign to see the 30-day headcount forecast</p>
            </div>
          ) : loadingForecast ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Approved Leaves</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Projected</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(forecast as ForecastDay[]).map(day => {
                    const campaign = (campaigns as Campaign[]).find(c => c.id === forecastCampaignId);
                    const min = campaign?.minHeadcount ?? 0;
                    const isUnder = day.projected < min;
                    return (
                      <tr key={day.date} className={`hover:bg-muted/20 transition-colors ${isUnder ? "bg-red-50/50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs">{day.date}</td>
                        <td className="px-4 py-3 text-muted-foreground">{DAY_FULL[day.dayOfWeek]}</td>
                        <td className="px-4 py-3">{day.scheduled}</td>
                        <td className="px-4 py-3 text-amber-600">{day.approvedLeaves > 0 ? day.approvedLeaves : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${isUnder ? "text-red-600" : "text-emerald-600"}`}>{day.projected}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isUnder ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1" variant="outline">
                              <AlertTriangle className="h-3 w-3" /> Under {min - day.projected} short
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs" variant="outline">
                              <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> OK
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isUnder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                              onClick={() => {
                                setOvertimeCampaignId(forecastCampaignId);
                                setOvertimeDate(day.date);
                                setOvertimeMessage(`Overtime needed on ${day.date}. We are ${min - day.projected} agent(s) short. Are you available?`);
                                setOvertimeDialog(true);
                              }}
                            >
                              <Bell className="h-3 w-3" /> Alert
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Agent Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Agent — {editingAgent?.traineeCode}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <Input value={editForm.fullName ?? ""} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">English Alias</label>
              <Input value={editForm.alias ?? ""} onChange={e => setEditForm(f => ({ ...f, alias: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input type="email" value={editForm.email ?? ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
              <Input value={editForm.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.campaignId ?? ""} onChange={e => setEditForm(f => ({ ...f, campaignId: e.target.value }))}>
                <option value="">No campaign</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Hours</label>
              <Input value={editForm.shiftHours ?? ""} onChange={e => setEditForm(f => ({ ...f, shiftHours: e.target.value }))} placeholder="e.g. 9AM–5PM" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Leader</label>
              <Input value={editForm.teamLeader ?? ""} onChange={e => setEditForm(f => ({ ...f, teamLeader: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Join Date</label>
              <Input type="date" value={editForm.joinDateStr ?? ""} onChange={e => setEditForm(f => ({ ...f, joinDateStr: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 1</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.offDay1 ?? ""} onChange={e => setEditForm(f => ({ ...f, offDay1: e.target.value }))}>
                <option value="">None</option>
                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Off Day 2</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editForm.offDay2 ?? ""} onChange={e => setEditForm(f => ({ ...f, offDay2: e.target.value }))}>
                <option value="">None</option>
                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive ?? true}
                onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="isActive" className="text-sm font-medium">Active (working in operations)</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAgent} disabled={updateAgent.isPending}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign Name</label>
              <Input placeholder="e.g. CMPN-100" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Headcount / Day</label>
                <Input type="number" min={1} value={campaignForm.minHeadcount} onChange={e => setCampaignForm(f => ({ ...f, minHeadcount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Work Days</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={campaignForm.workDays} onChange={e => setCampaignForm(f => ({ ...f, workDays: e.target.value as "all" | "weekdays" }))}>
                  <option value="all">All 7 days</option>
                  <option value="weekdays">Weekdays only</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input placeholder="Any notes about this campaign..." value={campaignForm.notes} onChange={e => setCampaignForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCampaignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCampaign} disabled={createCampaign.isPending || updateCampaign.isPending}>
              {editingCampaign ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overtime Alert Dialog */}
      <Dialog open={overtimeDialog} onOpenChange={setOvertimeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-amber-600" /> Send Overtime Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={overtimeCampaignId ?? ""} onChange={e => setOvertimeCampaignId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select campaign...</option>
                {(campaigns as Campaign[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Message to agents</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={overtimeMessage}
                onChange={e => setOvertimeMessage(e.target.value)}
                placeholder="Overtime needed on this date. Are you available?"
              />
            </div>
            <p className="text-xs text-muted-foreground">This will send a notification to all active agents in the selected campaign. They can respond with Available/Unavailable in their portal.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOvertimeDialog(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              disabled={!overtimeCampaignId || !overtimeDate || sendOvertimeAlert.isPending}
              onClick={() => {
                if (!overtimeCampaignId || !overtimeDate) return;
                sendOvertimeAlert.mutate({ campaignId: overtimeCampaignId, date: overtimeDate, message: overtimeMessage || undefined });
              }}
            >
              <Bell className="h-4 w-4" /> Send Alert
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
