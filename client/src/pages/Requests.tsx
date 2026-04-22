import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: "Leave / Day Off",
  salary: "Salary Inquiry",
  schedule: "Schedule Change",
  complaint: "General Complaint",
  other: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending:     { label: "Pending",     className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  in_progress: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200",       icon: Loader2 },
  resolved:    { label: "Resolved",    className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  rejected:    { label: "Rejected",    className: "bg-red-50 text-red-700 border-red-200",           icon: XCircle },
};

type AgentRequest = {
  id: number;
  candidateId: number;
  traineeCode: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const BRAND = "oklch(0.32 0.18 28)";

export default function Requests() {
  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.requests.listAll.useQuery();
  const updateMutation = trpc.requests.updateStatus.useMutation({
    onSuccess: () => {
      utils.requests.listAll.invalidate();
      toast.success("Request updated");
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<AgentRequest | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  function openRequest(req: AgentRequest) {
    setSelected(req);
    setReplyText(req.adminReply ?? "");
    setNewStatus(req.status);
  }

  function handleUpdate() {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      status: newStatus as "pending" | "in_progress" | "resolved" | "rejected",
      adminReply: replyText.trim() || undefined,
    });
  }

  const filtered = filterStatus === "all"
    ? (requests as AgentRequest[])
    : (requests as AgentRequest[]).filter((r) => r.status === filterStatus);

  const counts = {
    all: requests.length,
    pending: (requests as AgentRequest[]).filter((r) => r.status === "pending").length,
    in_progress: (requests as AgentRequest[]).filter((r) => r.status === "in_progress").length,
    resolved: (requests as AgentRequest[]).filter((r) => r.status === "resolved").length,
    rejected: (requests as AgentRequest[]).filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
            <Inbox className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Request Center</h1>
            <p className="text-xs text-muted-foreground">Agent requests and inquiries</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {counts.pending} pending
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["pending", "in_progress", "resolved", "rejected"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                filterStatus === s ? cfg.className + " shadow-sm" : "bg-card border-border"
              }`}
            >
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts[s]}</p>
            </button>
          );
        })}
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Loading requests...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            return (
              <Card
                key={req.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => openRequest(req)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground">{req.traineeCode}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
                      </div>
                      <p className="font-semibold text-foreground text-sm truncate">{req.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  {req.adminReply && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <span className="font-medium">Reply:</span> {req.adminReply}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="bg-muted rounded px-2 py-0.5 font-medium">{selected.traineeCode}</span>
                <span className="bg-muted rounded px-2 py-0.5">{REQUEST_TYPE_LABELS[selected.type] ?? selected.type}</span>
                <span className="bg-muted rounded px-2 py-0.5">
                  {new Date(selected.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              {/* Message */}
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Update Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reply */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reply to Agent</label>
                <Textarea
                  placeholder="Write a reply that the agent will see in their portal..."
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              style={{ background: BRAND }}
              className="text-white hover:opacity-90"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
