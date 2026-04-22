import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Bell,
  User,
  CreditCard,
  MessageSquare,
  Users,
  LogOut,
  Paperclip,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";
const BRAND = "oklch(0.32 0.18 28)";
const BRAND_LIGHT = "oklch(0.42 0.18 28)";

function formatDate(ts: number | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: string | number | null | undefined) {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `EGP ${num.toLocaleString()}`;
}

type Tab = "profile" | "payroll" | "requests" | "referrals";

export default function AgentPortal() {
  const [, navigate] = useLocation();
  const { data: agent, isLoading } = trpc.agent.me.useQuery();
  const logoutMutation = trpc.agent.logout.useMutation();
  const { data: payroll } = trpc.agent.getPayroll.useQuery(
    { candidateId: agent?.candidateId ?? 0 },
    { enabled: !!agent?.candidateId }
  );
  const [activeTab, setActiveTab] = useState<Tab>("profile");

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
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }}
          />
          <p className="text-sm text-white/50">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "payroll", label: "Payroll", icon: <CreditCard className="w-4 h-4" /> },
    { id: "requests", label: "Requests", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "referrals", label: "Refer", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* ── Top Bar ── */}
      <header
        className="sticky top-0 z-30 border-b border-white/10"
        style={{ background: "rgba(15,15,15,0.95)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: BRAND }}
            >
              <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-4 h-4 object-contain" />
            </div>
            <span className="font-semibold text-sm text-white">Tanis Hub</span>
          </div>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? "text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
                style={activeTab === item.id ? { background: BRAND } : {}}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <NotificationBell candidateId={agent.candidateId} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-white/10">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-all ${
                activeTab === item.id ? "text-white" : "text-white/40"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${BRAND} 0%, oklch(0.22 0.12 28) 100%)`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Welcome back</p>
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <p className="text-white/70 text-sm mt-1">{agent.positionApplied}</p>
          </div>
          <div
            className="shrink-0 rounded-2xl px-5 py-3 text-center"
            style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
          >
            <p className="text-white/60 text-[10px] uppercase tracking-wider">Trainee ID</p>
            <p className="text-white font-bold text-xl tracking-widest mt-0.5">{agent.traineeCode}</p>
          </div>
        </div>
        {/* Decorative circles */}
        <div
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: "white" }}
        />
        <div
          className="absolute -right-4 bottom-0 w-32 h-32 rounded-full opacity-5"
          style={{ background: "white" }}
        />
      </div>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === "profile" && <ProfileTab agent={agent} />}
        {activeTab === "payroll" && (
          <PayrollTab payroll={payroll as PayrollRecord[] | undefined} />
        )}
        {activeTab === "requests" && (
          <RequestCenterTab candidateId={agent.candidateId} />
        )}
        {activeTab === "referrals" && (
          <ReferralTab referrerCandidateId={agent.candidateId} />
        )}
      </main>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ agent }: { agent: AgentData }) {
  const joinDate = agent.batch?.assignedAt
    ? formatDate(new Date(agent.batch.assignedAt))
    : "—";

  const fields = [
    { label: "Full Name", value: agent.name },
    { label: "Trainee ID", value: agent.traineeCode },
    { label: "Position", value: agent.positionApplied },
    { label: "Join Date", value: joinDate },
    { label: "Location", value: agent.location ?? "—" },
    { label: "Phone", value: agent.phone ?? "—" },
    { label: "Email", value: agent.email ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle>My Information</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-4 border border-white/8"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className="text-white font-medium text-sm">{value}</p>
          </div>
        ))}
      </div>

      {agent.batch && (
        <>
          <SectionTitle>Training Batch</SectionTitle>
          <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-white/8">
              {[
                { label: "Batch Name", value: agent.batch.name },
                { label: "Trainer", value: agent.batch.trainerName ?? "—" },
                { label: "Start Date", value: formatDate(agent.batch.startDate) },
              ].map(({ label, value }) => (
                <div key={label} className="p-4">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-white font-medium text-sm">{value}</p>
                </div>
              ))}
            </div>
            {/* Attendance bar */}
            {agent.batch.totalSessions != null && Number(agent.batch.totalSessions) > 0 && (
              <div className="px-4 py-4 border-t border-white/8">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/40 text-xs uppercase tracking-wider">Attendance</p>
                  <p className="text-white text-sm font-medium">
                    {Number(agent.batch.attendedSessions ?? 0)} / {Number(agent.batch.totalSessions)} sessions
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.round((Number(agent.batch.attendedSessions ?? 0) / Number(agent.batch.totalSessions)) * 100)}%`,
                      background: BRAND_LIGHT,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Payroll Tab ─────────────────────────────────────────────────────────────

type PayrollRecord = {
  id: number;
  month: string;
  grossSalary: string | number | null;
  deductions: string | number | null;
  netPay: string | number | null;
  status: string;
  paymentDate: number | null;
  notes: string | null;
};

function PayrollTab({ payroll }: { payroll?: PayrollRecord[] }) {
  if (!payroll || payroll.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard className="w-8 h-8 text-white/20" />}
        title="No payroll records yet"
        subtitle="Your salary details will appear here once processed."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Payroll History</SectionTitle>
      <div className="space-y-3">
        {payroll.map((record) => (
          <div
            key={record.id}
            className="rounded-xl border border-white/8 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <p className="font-semibold text-white">{record.month}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Payment date: {formatDate(record.paymentDate)}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  record.status === "paid"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {record.status === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/8">
              {[
                { label: "Gross", value: formatCurrency(record.grossSalary) },
                { label: "Deductions", value: record.deductions ? `- ${formatCurrency(record.deductions)}` : "—", red: true },
                { label: "Net Pay", value: formatCurrency(record.netPay), accent: true },
              ].map(({ label, value, red, accent }) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-white/40 text-xs mb-1">{label}</p>
                  <p
                    className={`text-sm font-semibold ${red ? "text-red-400" : ""}`}
                    style={accent ? { color: BRAND_LIGHT } : {}}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {record.notes && (
              <div className="px-5 py-3 border-t border-white/8">
                <p className="text-xs text-white/40">{record.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Request Center Tab ───────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: "Leave",
  salary: "Salary Inquiry",
  schedule: "Schedule Change",
  complaint: "General Complaint",
  resignation: "Resignation",
  day_off: "Day Off",
  sick_note: "Sick Note",
  other: "Other",
};

const DATE_REQUIRED_TYPES = ["leave", "day_off", "resignation"];
const MULTI_DATE_TYPES = ["leave", "day_off"];

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400" },
  in_progress: { label: "In Progress", className: "bg-blue-500/20 text-blue-400" },
  resolved: { label: "Resolved", className: "bg-emerald-500/20 text-emerald-400" },
  rejected: { label: "Rejected", className: "bg-red-500/20 text-red-400" },
};

function getMinDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function RequestCenterTab({ candidateId: _candidateId }: { candidateId: number }) {
  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } = trpc.requests.listMine.useQuery();
  const submitMutation = trpc.requests.submit.useMutation({
    onSuccess: () => {
      utils.requests.listMine.invalidate();
      toast.success("Request submitted successfully");
      resetForm();
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadMutation = trpc.requests.uploadAttachment.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "",
    subject: "",
    message: "",
    requestedDate: "", // single date (resignation)
    requestedDates: [] as string[], // multi-day (leave, day_off)
    attachmentUrl: "",
    attachmentName: "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsDate = DATE_REQUIRED_TYPES.includes(form.type);
  const isMultiDate = MULTI_DATE_TYPES.includes(form.type);

  function resetForm() {
    setForm({ type: "", subject: "", message: "", requestedDate: "", requestedDates: [], attachmentUrl: "", attachmentName: "" });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("File too large (max 16MB)"); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      setForm((f) => ({ ...f, attachmentUrl: result.url, attachmentName: file.name }));
      toast.success("File uploaded");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleDate(dateStr: string) {
    setForm((f) => {
      const exists = f.requestedDates.includes(dateStr);
      return {
        ...f,
        requestedDates: exists
          ? f.requestedDates.filter((d) => d !== dateStr)
          : [...f.requestedDates, dateStr].sort(),
      };
    });
  }

  function handleSubmit() {
    if (!form.type) { toast.error("Please select a request type"); return; }
    if (!form.subject.trim()) { toast.error("Please enter a subject"); return; }
    if (!form.message.trim()) { toast.error("Please describe your request"); return; }
    if (needsDate) {
      if (isMultiDate && form.requestedDates.length === 0) {
        toast.error("Please select at least one date"); return;
      }
      if (!isMultiDate && !form.requestedDate) {
        toast.error("Please select a date (minimum 2 weeks from today)"); return;
      }
    }
    submitMutation.mutate({
      type: form.type as "leave" | "salary" | "schedule" | "complaint" | "resignation" | "day_off" | "sick_note" | "other",
      subject: form.subject.trim(),
      message: form.message.trim(),
      requestedDate: (!isMultiDate && form.requestedDate) ? new Date(form.requestedDate).getTime() : undefined,
      requestedDates: (isMultiDate && form.requestedDates.length > 0) ? form.requestedDates : undefined,
      attachmentUrl: form.attachmentUrl || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>My Requests</SectionTitle>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="text-white text-sm"
            style={{ background: BRAND }}
          >
            + New Request
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="rounded-2xl border border-white/10 p-6 space-y-5"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Submit a Request</p>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Request Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, requestedDate: "", requestedDates: [] }))}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="day_off">Day Off</SelectItem>
                <SelectItem value="sick_note">Sick Note</SelectItem>
                <SelectItem value="resignation">Resignation</SelectItem>
                <SelectItem value="salary">Salary Inquiry</SelectItem>
                <SelectItem value="schedule">Schedule Change</SelectItem>
                <SelectItem value="complaint">General Complaint</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date(s) */}
          {needsDate && isMultiDate && (
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                Select Dates <span className="text-white/30 normal-case">(min. 2 weeks from today — pick multiple)</span>
              </Label>
              <MultiDatePicker
                selectedDates={form.requestedDates}
                onToggle={toggleDate}
                minDate={getMinDateStr()}
              />
              {form.requestedDates.length > 0 && (
                <p className="text-xs text-white/40">
                  {form.requestedDates.length} day{form.requestedDates.length > 1 ? "s" : ""} selected:{" "}
                  {form.requestedDates.map((d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")}
                </p>
              )}
            </div>
          )}

          {needsDate && !isMultiDate && (
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {form.type === "resignation" ? "Last Working Day" : "Requested Date"}
                <span className="ml-1 text-white/30 normal-case">(min. 2 weeks from today)</span>
              </Label>
              <Input
                type="date"
                min={getMinDateStr()}
                value={form.requestedDate}
                onChange={(e) => setForm((f) => ({ ...f, requestedDate: e.target.value }))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Subject</Label>
            <Input
              placeholder="Brief summary of your request"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Message</Label>
            <Textarea
              placeholder="Describe your request in detail..."
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Attachment <span className="text-white/30 normal-case">(optional — any file, max 16MB)</span></Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            {form.attachmentUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <Paperclip className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-sm text-white/70 flex-1 truncate">{form.attachmentName}</span>
                <button
                  onClick={() => setForm((f) => ({ ...f, attachmentUrl: "", attachmentName: "" }))}
                  className="text-white/30 hover:text-white/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 border-dashed text-white/40 hover:text-white/70 hover:bg-white/8 transition-all text-sm w-full"
              >
                <Paperclip className="w-4 h-4" />
                {uploading ? "Uploading..." : "Attach a file"}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="border-white/10 text-white/60 hover:text-white bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || uploading}
              className="text-white"
              style={{ background: BRAND }}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-white/30 text-sm">Loading requests...</div>
      ) : (requests as RequestItem[]).length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8 text-white/20" />}
          title="No requests yet"
          subtitle="Use the button above to submit a request to the admin team."
        />
      ) : (
        <div className="space-y-3">
          {(requests as RequestItem[]).map((req) => {
            const st = STATUS_STYLES[req.status] ?? STATUS_STYLES.pending;
            const dates: string[] = req.requestedDates ? (() => { try { return JSON.parse(req.requestedDates); } catch { return []; } })() : [];
            return (
              <div
                key={req.id}
                className="rounded-xl border border-white/8 p-5"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{req.subject}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {REQUEST_TYPE_LABELS[req.type] ?? req.type} ·{" "}
                      {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${st.className}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm text-white/60 whitespace-pre-wrap">{req.message}</p>
                {dates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dates.map((d) => (
                      <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/50">
                        {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ))}
                  </div>
                )}
                {req.attachmentUrl && (
                  <a
                    href={req.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    View attachment
                  </a>
                )}
                {req.adminReply && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <p className="text-xs font-semibold text-white/50 mb-1">Admin Reply</p>
                    <p className="text-sm text-white/70 whitespace-pre-wrap bg-white/5 rounded-lg px-3 py-2">
                      {req.adminReply}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type RequestItem = {
  id: number;
  type: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  requestedDates: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
};

// ─── Multi-Date Picker ────────────────────────────────────────────────────────

function MultiDatePicker({
  selectedDates,
  onToggle,
  minDate,
}: {
  selectedDates: string[];
  onToggle: (date: string) => void;
  minDate: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const minDateObj = new Date(minDate);
  minDateObj.setHours(0, 0, 0, 0);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      className="rounded-xl border border-white/10 p-4"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium text-white">{monthName}</p>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] text-white/30 py-1">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dateObj = new Date(dateStr);
          dateObj.setHours(0, 0, 0, 0);
          const disabled = dateObj < minDateObj;
          const selected = selectedDates.includes(dateStr);
          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => !disabled && onToggle(dateStr)}
              className={`aspect-square rounded-lg text-xs font-medium transition-all ${
                disabled
                  ? "text-white/15 cursor-not-allowed"
                  : selected
                  ? "text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              style={selected ? { background: BRAND } : {}}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Referral Tab ─────────────────────────────────────────────────────────────

function ReferralTab({ referrerCandidateId }: { referrerCandidateId: number }) {
  const utils = trpc.useUtils();
  const { data: referrals = [], isLoading } = trpc.referrals.listMine.useQuery({
    candidateId: referrerCandidateId,
  });
  const submitMutation = trpc.referrals.submit.useMutation({
    onSuccess: () => {
      utils.referrals.listMine.invalidate();
      toast.success("Referral submitted!");
      setForm({ name: "", phone: "", note: "" });
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", note: "" });

  const REFERRAL_STATUS: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400" },
    contacted: { label: "Contacted", className: "bg-blue-500/20 text-blue-400" },
    hired: { label: "Hired", className: "bg-emerald-500/20 text-emerald-400" },
    rejected: { label: "Not Hired", className: "bg-red-500/20 text-red-400" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Refer a Candidate</SectionTitle>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="text-white text-sm"
            style={{ background: BRAND }}
          >
            + Refer Someone
          </Button>
        )}
      </div>

      {showForm && (
        <div
          className="rounded-2xl border border-white/10 p-6 space-y-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Referral Details</p>
            <button onClick={() => { setShowForm(false); setForm({ name: "", phone: "", note: "" }); }} className="text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Candidate Full Name</Label>
            <Input placeholder="e.g. Ahmed Mohamed" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Phone Number</Label>
            <Input placeholder="e.g. 01012345678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Note <span className="text-white/30 normal-case">(optional)</span></Label>
            <Textarea placeholder="Why are you recommending this person?" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm({ name: "", phone: "", note: "" }); }} className="border-white/10 text-white/60 hover:text-white bg-transparent">Cancel</Button>
            <Button onClick={() => {
              if (!form.name.trim()) { toast.error("Please enter the candidate's name"); return; }
              if (!form.phone.trim()) { toast.error("Please enter the phone number"); return; }
              submitMutation.mutate({ referrerCandidateId, refereeName: form.name.trim(), refereePhone: form.phone.trim(), refereeNote: form.note.trim() || undefined });
            }} disabled={submitMutation.isPending} className="text-white" style={{ background: BRAND }}>
              {submitMutation.isPending ? "Submitting..." : "Submit Referral"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-white/30 text-sm">Loading referrals...</div>
      ) : (referrals as ReferralItem[]).length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-white/20" />}
          title="No referrals yet"
          subtitle="Know someone great for outbound sales? Refer them to Tanis."
        />
      ) : (
        <div className="space-y-3">
          {(referrals as ReferralItem[]).map((ref) => {
            const st = REFERRAL_STATUS[ref.status] ?? REFERRAL_STATUS.pending;
            return (
              <div key={ref.id} className="rounded-xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white text-sm">{ref.refereeName}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {ref.refereePhone} · Referred {new Date(ref.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {ref.refereeNote && <p className="text-xs text-white/40 mt-1 italic">"{ref.refereeNote}"</p>}
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${st.className}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ReferralItem = {
  id: number;
  refereeName: string;
  refereePhone: string;
  refereeNote: string | null;
  status: string;
  createdAt: Date;
};

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell({ candidateId }: { candidateId: number }) {
  const utils = trpc.useUtils();
  const { data: notifications = [] } = trpc.notifications.listMine.useQuery(
    { candidateId },
    { refetchInterval: 30000 }
  );
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.listMine.invalidate(),
  });
  const [open, setOpen] = useState(false);
  const unread = (notifications as NotifItem[]).filter((n) => !n.isRead).length;

  function handleOpen() {
    setOpen((v) => !v);
    if (unread > 0) markReadMutation.mutate({ candidateId });
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
            style={{ background: BRAND }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
          style={{ background: "#1a1a1a" }}
        >
          <div className="px-4 py-3 border-b border-white/10">
            <p className="font-semibold text-sm text-white">Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {(notifications as NotifItem[]).length === 0 ? (
              <p className="text-center text-sm text-white/30 py-8">No notifications yet</p>
            ) : (
              (notifications as NotifItem[]).map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-white/8 last:border-0 ${!n.isRead ? "bg-white/5" : ""}`}>
                  <p className="text-sm text-white/80">{n.message}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type NotifItem = { id: number; type: string; message: string; isRead: boolean; createdAt: Date };

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-white/80">{children}</h2>;
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      {icon}
      <p className="text-white/50 font-medium text-sm">{title}</p>
      <p className="text-white/30 text-xs max-w-xs">{subtitle}</p>
    </div>
  );
}

type AgentData = {
  candidateId: number;
  traineeCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  positionApplied: string;
  location: string | null;
  age: number | null;
  createdAt: Date;
  batch: {
    id: number;
    name: string;
    trainerName: string | null;
    startDate: number | null;
    notes: string | null;
    traineeCode: string;
    assignedAt: Date | null;
    attendedSessions: number | null;
    totalSessions: number | null;
    trainerNotes: string | null;
  } | null;
};

// Suppress unused import warning for Calendar icon
void Calendar;
