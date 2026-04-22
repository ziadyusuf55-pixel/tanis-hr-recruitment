import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";
const BRAND = "oklch(0.32 0.18 28)";

function formatDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(amount: string | number | null | undefined) {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `EGP ${num.toLocaleString()}`;
}

export default function AgentPortal() {
  const [, navigate] = useLocation();
  const { data: agent, isLoading } = trpc.agent.me.useQuery();
  const logoutMutation = trpc.agent.logout.useMutation();
  const { data: payroll } = trpc.agent.getPayroll.useQuery(
    { candidateId: agent?.candidateId ?? 0 },
    { enabled: !!agent?.candidateId }
  );

  useEffect(() => {
    if (!isLoading && !agent) {
      navigate("/login");
    }
  }, [isLoading, agent, navigate]);

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    navigate("/login");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
          <p className="text-sm text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  const batch = agent.batch;
  const attendance = batch;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
              <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <span className="font-semibold text-foreground text-sm">Tanis Hub</span>
              <span className="ml-2 text-xs text-muted-foreground">Agent Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{agent.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome card */}
        <div
          className="rounded-2xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND}, oklch(0.42 0.18 28))` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-sm mb-1">Welcome back,</p>
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <p className="text-white/80 text-sm mt-1">{agent.positionApplied}</p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-xl px-4 py-2">
                <p className="text-white/70 text-xs">Trainee ID</p>
                <p className="font-bold text-lg tracking-wider">{agent.traineeCode}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", value: agent.name },
                    { label: "Trainee ID", value: agent.traineeCode },
                    { label: "Position", value: agent.positionApplied },
                    { label: "Location", value: agent.location ?? "—" },
                    { label: "Phone", value: agent.phone ?? "—" },
                    { label: "Email", value: agent.email ?? "—" },
                    { label: "Join Date", value: formatDate(agent.createdAt ? new Date(agent.createdAt).getTime() : null) },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Training Tab ── */}
          <TabsContent value="training" className="mt-6 space-y-4">
            {!batch ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  You have not been assigned to a training batch yet. Please check back later.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Batch Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: "Batch Name", value: batch.name },
                        { label: "Trainer", value: batch.trainerName ?? "—" },
                        { label: "Start Date", value: formatDate(batch.startDate) },
                        { label: "End Date", value: "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Attendance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Attendance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {attendance ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Sessions Attended</span>
                          <span className="font-semibold text-foreground">
                            {Number(attendance.attendedSessions ?? 0)} / {Number(attendance.totalSessions ?? 0)}
                          </span>
                        </div>
                        {Number(attendance.totalSessions ?? 0) > 0 && (
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.round((Number(attendance.attendedSessions ?? 0) / Number(attendance.totalSessions ?? 1)) * 100)}%`,
                                background: BRAND,
                              }}
                            />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {Number(attendance.totalSessions ?? 0) > 0
                            ? `${Math.round((Number(attendance.attendedSessions ?? 0) / Number(attendance.totalSessions ?? 1)) * 100)}% attendance rate`
                            : "No sessions recorded yet"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No attendance data yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Trainer notes */}
                {attendance?.trainerNotes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Trainer Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{String(attendance.trainerNotes ?? "")}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Payroll Tab ── */}
          <TabsContent value="payroll" className="mt-6">
            {!payroll || payroll.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No payroll records available yet. Your salary information will appear here once processed.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payroll.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-foreground">{record.month}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Payment date: {formatDate(record.paymentDate)}
                          </p>
                        </div>
                        <Badge
                          variant={record.status === "paid" ? "default" : "secondary"}
                          className={record.status === "paid" ? "text-white" : ""}
                          style={record.status === "paid" ? { background: BRAND } : {}}
                        >
                          {record.status === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Gross Salary</p>
                          <p className="text-sm font-medium">{formatCurrency(record.grossSalary)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Deductions</p>
                          <p className="text-sm font-medium text-destructive">
                            {record.deductions ? `- ${formatCurrency(record.deductions)}` : "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Net Pay</p>
                          <p className="text-sm font-bold" style={{ color: BRAND }}>
                            {formatCurrency(record.netPay)}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                          {record.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ── Request Center Tab ── */}
          <TabsContent value="requests" className="mt-6 space-y-6">
            <RequestCenterTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: "Leave / Day Off",
  salary: "Salary Inquiry",
  schedule: "Schedule Change",
  complaint: "General Complaint",
  other: "Other",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending:     { label: "Pending",     className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  in_progress: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved:    { label: "Resolved",    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:    { label: "Rejected",    className: "bg-red-50 text-red-700 border-red-200" },
};

function RequestCenterTab() {
  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.requests.listMine.useQuery();
  const submitMutation = trpc.requests.submit.useMutation({
    onSuccess: () => {
      utils.requests.listMine.invalidate();
      toast.success("Request submitted successfully");
      setForm({ type: "", subject: "", message: "" });
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "", subject: "", message: "" });

  function handleSubmit() {
    if (!form.type) { toast.error("Please select a request type"); return; }
    if (!form.subject.trim()) { toast.error("Please enter a subject"); return; }
    if (!form.message.trim()) { toast.error("Please describe your request"); return; }
    submitMutation.mutate({
      type: form.type as "leave" | "salary" | "schedule" | "complaint" | "other",
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
  }

  return (
    <div className="space-y-4">
      {/* New Request Button */}
      {!showForm && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowForm(true)}
            style={{ background: BRAND }}
            className="text-white hover:opacity-90"
          >
            + New Request
          </Button>
        </div>
      )}

      {/* Submit Form */}
      {showForm && (
        <Card className="border-2" style={{ borderColor: BRAND + "40" }}>
          <CardHeader>
            <CardTitle className="text-base">Submit a Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Request Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Leave / Day Off</SelectItem>
                  <SelectItem value="salary">Salary Inquiry</SelectItem>
                  <SelectItem value="schedule">Schedule Change</SelectItem>
                  <SelectItem value="complaint">General Complaint</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                placeholder="Brief summary of your request"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                placeholder="Describe your request in detail..."
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setForm({ type: "", subject: "", message: "" }); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                style={{ background: BRAND }}
                className="text-white hover:opacity-90"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Loading requests...</CardContent></Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No requests submitted yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Use the button above to submit a new request to the admin team.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(requests as Array<{
            id: number; type: string; subject: string; message: string;
            status: string; adminReply: string | null; createdAt: Date;
          }>).map((req) => {
            const st = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending;
            return (
              <Card key={req.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{req.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {REQUEST_TYPE_LABELS[req.type] ?? req.type} · {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${st.className}`}>{st.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.message}</p>
                  {req.adminReply && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-foreground mb-1">Admin Reply</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg px-3 py-2">{req.adminReply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
