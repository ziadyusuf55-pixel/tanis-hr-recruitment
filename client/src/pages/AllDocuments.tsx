import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Download, FileText, ExternalLink, CheckCircle2, XCircle, Clock,
  MessageSquare, ChevronDown, ChevronRight,
} from "lucide-react";
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

type AgentGroup = {
  traineeCode: string;
  fullName: string;
  alias?: string | null;
  docs: AgentDocument[];
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
    <Badge className="gap-1 bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20 text-[10px]">
      <CheckCircle2 className="h-2.5 w-2.5" /> Approved
    </Badge>
  );
  if (status === "rejected") return (
    <Badge className="gap-1 bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20 text-[10px]">
      <XCircle className="h-2.5 w-2.5" /> Rejected
    </Badge>
  );
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30 text-[10px]">
      <Clock className="h-2.5 w-2.5" /> Pending
    </Badge>
  );
}

const STATUS_FILTERS = [
  { key: "all" as const, label: "All Agents" },
  { key: "submitted" as const, label: "Has Documents" },
  { key: "not_submitted" as const, label: "No Documents" },
  { key: "pending" as const, label: "Has Pending" },
];

export default function AllDocuments() {
  const utils = trpc.useUtils();
  const { data: allDocs = [], isLoading } = trpc.documents.listAll.useQuery();
  const { data: agents = [] } = trpc.workforce.list.useQuery({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "not_submitted" | "pending">("all");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const [commentDoc, setCommentDoc] = useState<AgentDocument | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState<"approved" | "rejected">("approved");

  const reviewMutation = trpc.documents.review.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      setCommentDoc(null);
      toast.success("Document reviewed");
    },
    onError: (e) => toast.error(e.message),
  });

  const agentList = useMemo(() =>
    (agents as Array<{ traineeCode: string; fullName: string; alias?: string | null }>),
    [agents]
  );

  const grouped = useMemo((): AgentGroup[] => {
    const docsByCode: Record<string, AgentDocument[]> = {};
    for (const doc of allDocs as AgentDocument[]) {
      if (!docsByCode[doc.traineeCode]) docsByCode[doc.traineeCode] = [];
      docsByCode[doc.traineeCode].push(doc);
    }
    const submittedCodes = new Set(Object.keys(docsByCode));
    const agentMap: Record<string, { fullName: string; alias?: string | null }> = {};
    for (const a of agentList) agentMap[a.traineeCode] = { fullName: a.fullName, alias: a.alias };

    const withDocs = Object.keys(docsByCode).map(code => ({
      traineeCode: code,
      fullName: agentMap[code]?.fullName ?? code,
      alias: agentMap[code]?.alias ?? null,
      docs: docsByCode[code],
    }));
    const withoutDocs = agentList
      .filter(a => !submittedCodes.has(a.traineeCode))
      .map(a => ({ traineeCode: a.traineeCode, fullName: a.fullName, alias: a.alias ?? null, docs: [] as AgentDocument[] }));
    return [...withDocs, ...withoutDocs];
  }, [allDocs, agentList]);

  const filteredGroups = useMemo(() => {
    let result = grouped;
    if (statusFilter === "submitted") result = result.filter(g => g.docs.length > 0);
    else if (statusFilter === "not_submitted") result = result.filter(g => g.docs.length === 0);
    else if (statusFilter === "pending") result = result.filter(g => g.docs.some(d => d.status === "pending"));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.fullName.toLowerCase().includes(q) ||
        (g.alias ?? "").toLowerCase().includes(q) ||
        g.traineeCode.toLowerCase().includes(q)
      );
    }
    return result;
  }, [grouped, statusFilter, search]);

  function toggleExpand(code: string) {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function exportCSV() {
    const docs = allDocs as AgentDocument[];
    if (docs.length === 0) { toast.error("Nothing to export"); return; }
    const agentMap: Record<string, { fullName: string; alias?: string | null }> = {};
    for (const a of agentList) agentMap[a.traineeCode] = { fullName: a.fullName, alias: a.alias };
    const headers = ["Agent Code", "Full Name", "Alias", "Document Type", "File Name", "Status", "Upload Date", "Admin Note"];
    const rows = docs.map(d => [
      d.traineeCode,
      agentMap[d.traineeCode]?.fullName ?? "",
      agentMap[d.traineeCode]?.alias ?? "",
      docTypeLabel(d.docType),
      d.fileName ?? "",
      d.status,
      d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-US") : "",
      d.adminComment ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${docs.length} records`);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agent Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All uploaded documents grouped by agent</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, alias, or code..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredGroups.length} agent{filteredGroups.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No agents match the current filter.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y">
            {filteredGroups.map(g => {
              const isExpanded = expandedCodes.has(g.traineeCode);
              const docCount = g.docs.length;
              const pendingCount = g.docs.filter(d => d.status === "pending").length;
              return (
                <div key={g.traineeCode}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => { if (docCount > 0) toggleExpand(g.traineeCode); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{g.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {g.traineeCode}{g.alias ? ` · ${g.alias}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {docCount === 0 ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">No documents</Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[10px]">
                            {docCount} doc{docCount !== 1 ? "s" : ""}
                          </Badge>
                          {pendingCount > 0 && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">
                              {pendingCount} pending
                            </Badge>
                          )}
                        </>
                      )}
                      {docCount > 0 && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && docCount > 0 && (
                    <div className="bg-muted/20 border-t divide-y">
                      {g.docs.map(doc => (
                        <div key={doc.id} className="px-6 py-3 flex items-center gap-3 flex-wrap">
                          <div className="w-7 h-7 rounded-md bg-background border flex items-center justify-center shrink-0">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{docTypeLabel(doc.docType)}</span>
                              <StatusBadge status={doc.status} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {doc.fileName ?? "View File"}
                              </a>
                              <span className="text-xs text-muted-foreground">
                                {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                              </span>
                            </div>
                            {doc.adminComment && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">"{doc.adminComment}"</p>
                            )}
                          </div>
                          <button
                            className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Review / add note"
                            onClick={() => {
                              setCommentDoc(doc);
                              setCommentText(doc.adminComment ?? "");
                              setCommentStatus(doc.status === "pending" ? "approved" : doc.status);
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!commentDoc} onOpenChange={(o) => { if (!o) setCommentDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          {commentDoc && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {agentList.find(a => a.traineeCode === commentDoc.traineeCode)?.fullName ?? commentDoc.traineeCode}
                </span>
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
                            : "bg-red-500/20 text-red-700 border-red-500/40 dark:text-red-400"
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
