import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Download, FileText, ExternalLink, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type AgentDocument = {
  id: number;
  traineeCode: string;
  docType: string;
  fileUrl: string;
  fileName?: string | null;
  status: "pending" | "approved" | "rejected";
  adminComment?: string | null;
  uploadedAt: Date | string;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id: "National ID",
  qualification: "Qualification / Certificate",
  cv: "CV / Resume",
  personal_photos: "Personal Photos",
  military_status: "Military Status",
  insurance_status: "Insurance Status",
  criminal_record: "Criminal Record",
  work_record: "كعب عمل",
  insurance_print: "برنت تاميني",
  form_111: "استماره 111",
  certificate: "Certificate",
  contract: "Contract",
  other: "Other",
};

function docTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function StatusBadge({ status }: { status: AgentDocument["status"] }) {
  if (status === "approved") return (
    <Badge className="gap-1 bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </Badge>
  );
  if (status === "rejected") return (
    <Badge className="gap-1 bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">
      <XCircle className="h-3 w-3" /> Rejected
    </Badge>
  );
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
}

export default function AllDocuments() {
  const utils = trpc.useUtils();
  const { data: allDocs = [], isLoading } = trpc.documents.listAll.useQuery();
  const { data: agents = [] } = trpc.workforce.list.useQuery({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Comment / review dialog state
  const [commentDoc, setCommentDoc] = useState<AgentDocument | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState<"approved" | "rejected">("approved");

  const reviewMutation = trpc.documents.review.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      setCommentDoc(null);
      toast.success("Document updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Build agent map
  const agentMap = useMemo(() => {
    const m: Record<string, { fullName: string; alias?: string | null }> = {};
    (agents as Array<{ traineeCode: string; fullName: string; alias?: string | null }>).forEach(a => {
      m[a.traineeCode] = { fullName: a.fullName, alias: a.alias };
    });
    return m;
  }, [agents]);

  // Unique doc types for filter
  const docTypes = useMemo(() => {
    const types = new Set((allDocs as AgentDocument[]).map(d => d.docType));
    return Array.from(types).sort();
  }, [allDocs]);

  const filtered = useMemo(() => {
    return (allDocs as AgentDocument[]).filter(d => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter !== "all" && d.docType !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const agent = agentMap[d.traineeCode];
        const name = agent?.fullName?.toLowerCase() ?? "";
        const alias = agent?.alias?.toLowerCase() ?? "";
        const code = d.traineeCode.toLowerCase();
        const file = (d.fileName ?? "").toLowerCase();
        if (!name.includes(q) && !alias.includes(q) && !code.includes(q) && !file.includes(q)) return false;
      }
      return true;
    });
  }, [allDocs, statusFilter, typeFilter, search, agentMap]);

  function exportCSV() {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    const headers = ["Agent Code", "Full Name", "Alias", "Document Type", "File Name", "Status", "Upload Date", "Admin Note"];
    const rows = filtered.map(d => {
      const agent = agentMap[d.traineeCode];
      return [
        d.traineeCode,
        agent?.fullName ?? "",
        agent?.alias ?? "",
        docTypeLabel(d.docType),
        d.fileName ?? "",
        d.status,
        d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-US") : "",
        d.adminComment ?? "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} records`);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agent Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All uploaded documents across all agents</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, alias, code, or file..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Status filter */}
          <div className="flex gap-1.5">
            {(["all", "pending", "approved", "rejected"] as const).map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize">
                {s === "all" ? "All Statuses" : s}
              </Button>
            ))}
          </div>
          {/* Type filter */}
          {docTypes.length > 0 && (
            <select
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {docTypes.map(t => <option key={t} value={t}>{docTypeLabel(t)}</option>)}
            </select>
          )}
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No documents found</p>
            <p className="text-sm mt-1">Agents upload documents from their portal.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Document Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">File</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Upload Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Admin Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(d => {
                  const agent = agentMap[d.traineeCode];
                  return (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{agent?.fullName ?? d.traineeCode}</p>
                        <p className="text-xs text-muted-foreground">{d.traineeCode}{agent?.alias ? ` · ${agent.alias}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{docTypeLabel(d.docType)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[180px]">{d.fileName ?? "View File"}</span>
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground truncate flex-1">{d.adminComment ?? "—"}</p>
                          <button
                            className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                            title="Review / add note"
                            onClick={() => {
                              setCommentDoc(d);
                              setCommentText(d.adminComment ?? "");
                              setCommentStatus(d.status === "pending" ? "approved" : d.status);
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review / Comment Dialog */}
      <Dialog open={!!commentDoc} onOpenChange={(o) => { if (!o) setCommentDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          {commentDoc && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{agentMap[commentDoc.traineeCode]?.fullName ?? commentDoc.traineeCode}</span>
                {" · "}
                {docTypeLabel(commentDoc.docType)}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Status</p>
                <div className="flex gap-2">
                  {(["approved", "rejected"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setCommentStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        commentStatus === s
                          ? s === "approved"
                            ? "bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-400"
                            : s === "rejected"
                            ? "bg-red-500/20 text-red-700 border-red-500/40 dark:text-red-400"
                            : "bg-amber-500/20 text-amber-700 border-amber-500/40 dark:text-amber-400"
                          : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Admin Note</p>
                <Textarea
                  placeholder="Add a note for this document (e.g., 'Rejected — signature missing')..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDoc(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!commentDoc) return;
                reviewMutation.mutate({ id: commentDoc.id, status: commentStatus, adminComment: commentText });
              }}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
