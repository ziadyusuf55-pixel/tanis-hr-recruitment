import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Sun,
  Moon,
} from "lucide-react";

const TANIS_LOGO_WHITE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";
const BRAND = "oklch(0.32 0.18 28)";
const BRAND_LIGHT = "oklch(0.42 0.18 28)";
const THEME_KEY = "tanis-agent-theme";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
type Theme = {
  bg: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textMuted: string;
  textFaint: string;
  headerBg: string;
  headerBorder: string;
  mobileNavBorder: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  navActive: string;
  navInactive: string;
  navHover: string;
  badgePending: string;
  badgeInProgress: string;
  badgeResolved: string;
  badgeRejected: string;
  notifBg: string;
  notifUnread: string;
  toggleBg: string;
  toggleText: string;
};

const DARK: Theme = {
  bg: "#0f0f0f",
  surface: "rgba(255,255,255,0.04)",
  surfaceBorder: "rgba(255,255,255,0.08)",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.6)",
  textFaint: "rgba(255,255,255,0.3)",
  headerBg: "rgba(15,15,15,0.95)",
  headerBorder: "rgba(255,255,255,0.10)",
  mobileNavBorder: "rgba(255,255,255,0.10)",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.08)",
  inputBg: "rgba(255,255,255,0.05)",
  inputBorder: "rgba(255,255,255,0.10)",
  navActive: "#ffffff",
  navInactive: "rgba(255,255,255,0.50)",
  navHover: "rgba(255,255,255,0.05)",
  badgePending: "bg-yellow-500/20 text-yellow-400",
  badgeInProgress: "bg-blue-500/20 text-blue-400",
  badgeResolved: "bg-emerald-500/20 text-emerald-400",
  badgeRejected: "bg-red-500/20 text-red-400",
  notifBg: "#1a1a1a",
  notifUnread: "rgba(255,255,255,0.05)",
  toggleBg: "rgba(255,255,255,0.08)",
  toggleText: "rgba(255,255,255,0.60)",
};

const LIGHT: Theme = {
  bg: "#f5f5f4",
  surface: "rgba(0,0,0,0.03)",
  surfaceBorder: "rgba(0,0,0,0.08)",
  text: "#1a1a1a",
  textMuted: "rgba(0,0,0,0.55)",
  textFaint: "rgba(0,0,0,0.35)",
  headerBg: "rgba(255,255,255,0.95)",
  headerBorder: "rgba(0,0,0,0.08)",
  mobileNavBorder: "rgba(0,0,0,0.08)",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.07)",
  inputBg: "#ffffff",
  inputBorder: "rgba(0,0,0,0.12)",
  navActive: "#ffffff",
  navInactive: "rgba(0,0,0,0.45)",
  navHover: "rgba(0,0,0,0.04)",
  badgePending: "bg-yellow-100 text-yellow-700",
  badgeInProgress: "bg-blue-100 text-blue-700",
  badgeResolved: "bg-emerald-100 text-emerald-700",
  badgeRejected: "bg-red-100 text-red-700",
  notifBg: "#ffffff",
  notifUnread: "rgba(0,0,0,0.03)",
  toggleBg: "rgba(0,0,0,0.06)",
  toggleText: "rgba(0,0,0,0.50)",
};

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
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved !== null ? saved === "dark" : true; // default dark
  });

  const theme = isDark ? DARK : LIGHT;

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: theme.textMuted }}>Loading your portal...</p>
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
    <div className="min-h-screen transition-colors duration-200" style={{ background: theme.bg, color: theme.text }}>
      {/* ── Top Bar ── */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: theme.headerBg,
          borderBottom: `1px solid ${theme.headerBorder}`,
          backdropFilter: "blur(12px)",
        }}
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
            <span className="font-semibold text-sm" style={{ color: theme.text }}>Tanis Hub</span>
          </div>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={
                  activeTab === item.id
                    ? { background: BRAND, color: "#ffffff" }
                    : { color: theme.navInactive }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== item.id) (e.currentTarget as HTMLElement).style.background = theme.navHover;
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== item.id) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all"
              style={{ background: theme.toggleBg, color: theme.toggleText }}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NotificationBell candidateId={agent.candidateId} theme={theme} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{ color: theme.navInactive }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = theme.text; (e.currentTarget as HTMLElement).style.background = theme.navHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = theme.navInactive; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex" style={{ borderTop: `1px solid ${theme.mobileNavBorder}` }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-all"
              style={{ color: activeTab === item.id ? theme.text : theme.navInactive }}
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
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10" style={{ background: "white" }} />
        <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full opacity-5" style={{ background: "white" }} />
      </div>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === "profile" && <ProfileTab agent={agent} theme={theme} />}
        {activeTab === "payroll" && <PayrollTab payroll={payroll as PayrollRecord[] | undefined} theme={theme} />}
        {activeTab === "requests" && <RequestCenterTab candidateId={agent.candidateId} theme={theme} />}
        {activeTab === "referrals" && <ReferralTab referrerCandidateId={agent.candidateId} theme={theme} />}
      </main>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ agent, theme }: { agent: AgentData; theme: Theme }) {
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
      <SectionTitle theme={theme}>My Information</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textFaint }}>{label}</p>
            <p className="font-medium text-sm" style={{ color: theme.text }}>{value}</p>
          </div>
        ))}
      </div>

      {agent.batch && (
        <>
          <SectionTitle theme={theme}>Training Batch</SectionTitle>
          <div className="rounded-xl overflow-hidden" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3" style={{ borderBottom: `1px solid ${theme.surfaceBorder}` }}>
              {[
                { label: "Batch Name", value: agent.batch.name },
                { label: "Trainer", value: agent.batch.trainerName ?? "—" },
                { label: "Start Date", value: formatDate(agent.batch.startDate) },
              ].map(({ label, value }, i) => (
                <div key={label} className="p-4" style={i > 0 ? { borderLeft: `1px solid ${theme.surfaceBorder}` } : {}}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textFaint }}>{label}</p>
                  <p className="font-medium text-sm" style={{ color: theme.text }}>{value}</p>
                </div>
              ))}
            </div>
            {agent.batch.totalSessions != null && Number(agent.batch.totalSessions) > 0 && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wider" style={{ color: theme.textFaint }}>Attendance</p>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>
                    {Number(agent.batch.attendedSessions ?? 0)} / {Number(agent.batch.totalSessions)} sessions
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: theme.surfaceBorder }}>
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

function PayrollTab({ payroll, theme }: { payroll?: PayrollRecord[]; theme: Theme }) {
  if (!payroll || payroll.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard className="w-8 h-8" style={{ color: theme.textFaint }} />}
        title="No payroll records yet"
        subtitle="Your salary details will appear here once processed."
        theme={theme}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle theme={theme}>Payroll History</SectionTitle>
      <div className="space-y-3">
        {payroll.map((record) => (
          <div
            key={record.id}
            className="rounded-xl overflow-hidden"
            style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
              <div>
                <p className="font-semibold" style={{ color: theme.text }}>{record.month}</p>
                <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
                  Payment date: {formatDate(record.paymentDate)}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  record.status === "paid"
                    ? "bg-emerald-500/20 text-emerald-600"
                    : "bg-yellow-500/20 text-yellow-600"
                }`}
              >
                {record.status === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="grid grid-cols-3" style={{ borderBottom: record.notes ? `1px solid ${theme.cardBorder}` : "none" }}>
              {[
                { label: "Gross", value: formatCurrency(record.grossSalary), accent: false, red: false },
                { label: "Deductions", value: record.deductions ? `- ${formatCurrency(record.deductions)}` : "—", red: true, accent: false },
                { label: "Net Pay", value: formatCurrency(record.netPay), accent: true, red: false },
              ].map(({ label, value, red, accent }, i) => (
                <div key={label} className="px-4 py-3" style={i > 0 ? { borderLeft: `1px solid ${theme.cardBorder}` } : {}}>
                  <p className="text-xs mb-1" style={{ color: theme.textFaint }}>{label}</p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: red ? "#ef4444" : accent ? BRAND_LIGHT : theme.text }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {record.notes && (
              <div className="px-5 py-3">
                <p className="text-xs" style={{ color: theme.textFaint }}>{record.notes}</p>
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

function getStatusStyle(status: string, theme: Theme) {
  const map: Record<string, string> = {
    pending: theme.badgePending,
    in_progress: theme.badgeInProgress,
    resolved: theme.badgeResolved,
    rejected: theme.badgeRejected,
  };
  return map[status] ?? map.pending;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
    rejected: "Rejected",
  };
  return map[status] ?? "Pending";
}

function getMinDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function RequestCenterTab({ candidateId: _candidateId, theme }: { candidateId: number; theme: Theme }) {
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
    requestedDate: "",
    requestedDates: [] as string[],
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
      if (isMultiDate && form.requestedDates.length === 0) { toast.error("Please select at least one date"); return; }
      if (!isMultiDate && !form.requestedDate) { toast.error("Please select a date (minimum 2 weeks from today)"); return; }
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

  const inputStyle = {
    background: theme.inputBg,
    border: `1px solid ${theme.inputBorder}`,
    color: theme.text,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle theme={theme}>My Requests</SectionTitle>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="text-white text-sm" style={{ background: BRAND }}>
            + New Request
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl p-6 space-y-5" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold" style={{ color: theme.text }}>Submit a Request</p>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={{ color: theme.textFaint }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Request Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, requestedDate: "", requestedDates: [] }))}>
              <SelectTrigger style={inputStyle}>
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

          {needsDate && isMultiDate && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
                Select Dates <span className="normal-case" style={{ color: theme.textFaint }}>(min. 2 weeks from today — pick multiple)</span>
              </Label>
              <MultiDatePicker selectedDates={form.requestedDates} onToggle={toggleDate} minDate={getMinDateStr()} theme={theme} />
              {form.requestedDates.length > 0 && (
                <p className="text-xs" style={{ color: theme.textFaint }}>
                  {form.requestedDates.length} day{form.requestedDates.length > 1 ? "s" : ""} selected:{" "}
                  {form.requestedDates.map((d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")}
                </p>
              )}
            </div>
          )}

          {needsDate && !isMultiDate && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
                {form.type === "resignation" ? "Last Working Day" : "Requested Date"}
                <span className="ml-1 normal-case" style={{ color: theme.textFaint }}>(min. 2 weeks from today)</span>
              </Label>
              <Input type="date" min={getMinDateStr()} value={form.requestedDate} onChange={(e) => setForm((f) => ({ ...f, requestedDate: e.target.value }))} style={inputStyle} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Subject</Label>
            <Input placeholder="Brief summary of your request" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} style={inputStyle} className="placeholder:text-gray-400" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Message</Label>
            <Textarea placeholder="Describe your request in detail..." rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} style={inputStyle} className="resize-none placeholder:text-gray-400" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
              Attachment <span className="normal-case" style={{ color: theme.textFaint }}>(optional — any file, max 16MB)</span>
            </Label>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            {form.attachmentUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}>
                <Paperclip className="w-4 h-4 shrink-0" style={{ color: theme.textFaint }} />
                <span className="text-sm flex-1 truncate" style={{ color: theme.textMuted }}>{form.attachmentName}</span>
                <button onClick={() => setForm((f) => ({ ...f, attachmentUrl: "", attachmentName: "" }))} style={{ color: theme.textFaint }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-sm transition-all"
                style={{ background: theme.inputBg, border: `1px dashed ${theme.inputBorder}`, color: theme.textFaint }}
              >
                <Paperclip className="w-4 h-4" />
                {uploading ? "Uploading..." : "Attach a file"}
              </button>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); resetForm(); }}
              style={{ borderColor: theme.surfaceBorder, color: theme.textMuted, background: "transparent" }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending || uploading} className="text-white" style={{ background: BRAND }}>
              {submitMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: theme.textFaint }}>Loading requests...</div>
      ) : (requests as RequestItem[]).length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" style={{ color: theme.textFaint }} />}
          title="No requests yet"
          subtitle="Use the button above to submit a request to the admin team."
          theme={theme}
        />
      ) : (
        <div className="space-y-3">
          {(requests as RequestItem[]).map((req) => {
            const dates: string[] = req.requestedDates ? (() => { try { return JSON.parse(req.requestedDates); } catch { return []; } })() : [];
            return (
              <div key={req.id} className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: theme.text }}>{req.subject}</p>
                    <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
                      {REQUEST_TYPE_LABELS[req.type] ?? req.type} ·{" "}
                      {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${getStatusStyle(req.status, theme)}`}>
                    {getStatusLabel(req.status)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: theme.textMuted }}>{req.message}</p>
                {dates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dates.map((d) => (
                      <span key={d} className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme.surface, color: theme.textMuted }}>
                        {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ))}
                  </div>
                )}
                {req.attachmentUrl && (
                  <a href={req.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs transition-colors" style={{ color: theme.textFaint }}>
                    <Paperclip className="w-3.5 h-3.5" />
                    View attachment
                  </a>
                )}
                {req.adminReply && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.surfaceBorder}` }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: theme.textFaint }}>Admin Reply</p>
                    <p className="text-sm whitespace-pre-wrap rounded-lg px-3 py-2" style={{ color: theme.textMuted, background: theme.surface }}>
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
  theme,
}: {
  selectedDates: string[];
  onToggle: (date: string) => void;
  minDate: string;
  theme: Theme;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const minDateObj = new Date(minDate);
  minDateObj.setHours(0, 0, 0, 0);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
    <div className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded-lg transition-colors" style={{ color: theme.textMuted }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium" style={{ color: theme.text }}>{monthName}</p>
        <button onClick={nextMonth} className="p-1 rounded-lg transition-colors" style={{ color: theme.textMuted }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] py-1" style={{ color: theme.textFaint }}>{d}</div>
        ))}
      </div>
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
              className="aspect-square rounded-lg text-xs font-medium transition-all"
              style={
                disabled
                  ? { color: theme.textFaint, cursor: "not-allowed" }
                  : selected
                  ? { background: BRAND, color: "#ffffff" }
                  : { color: theme.textMuted }
              }
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

function ReferralTab({ referrerCandidateId, theme }: { referrerCandidateId: number; theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: referrals = [], isLoading } = trpc.referrals.listMine.useQuery({ candidateId: referrerCandidateId });
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
    pending: { label: "Pending", className: theme.badgePending },
    contacted: { label: "Contacted", className: theme.badgeInProgress },
    hired: { label: "Hired", className: theme.badgeResolved },
    rejected: { label: "Not Hired", className: theme.badgeRejected },
  };

  const inputStyle = { background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.text };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle theme={theme}>Refer a Candidate</SectionTitle>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="text-white text-sm" style={{ background: BRAND }}>
            + Refer Someone
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold" style={{ color: theme.text }}>Referral Details</p>
            <button onClick={() => { setShowForm(false); setForm({ name: "", phone: "", note: "" }); }} style={{ color: theme.textFaint }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Candidate Full Name</Label>
            <Input placeholder="e.g. Ahmed Mohamed" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} className="placeholder:text-gray-400" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Phone Number</Label>
            <Input placeholder="e.g. 01012345678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} className="placeholder:text-gray-400" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Note <span className="normal-case" style={{ color: theme.textFaint }}>(optional)</span></Label>
            <Textarea placeholder="Why are you recommending this person?" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} style={inputStyle} className="resize-none placeholder:text-gray-400" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm({ name: "", phone: "", note: "" }); }} style={{ borderColor: theme.surfaceBorder, color: theme.textMuted, background: "transparent" }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) { toast.error("Please enter the candidate's name"); return; }
                if (!form.phone.trim()) { toast.error("Please enter the phone number"); return; }
                submitMutation.mutate({ referrerCandidateId, refereeName: form.name.trim(), refereePhone: form.phone.trim(), refereeNote: form.note.trim() || undefined });
              }}
              disabled={submitMutation.isPending}
              className="text-white"
              style={{ background: BRAND }}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Referral"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: theme.textFaint }}>Loading referrals...</div>
      ) : (referrals as ReferralItem[]).length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" style={{ color: theme.textFaint }} />}
          title="No referrals yet"
          subtitle="Know someone great for outbound sales? Refer them to Tanis."
          theme={theme}
        />
      ) : (
        <div className="space-y-3">
          {(referrals as ReferralItem[]).map((ref) => {
            const st = REFERRAL_STATUS[ref.status] ?? REFERRAL_STATUS.pending;
            return (
              <div key={ref.id} className="rounded-xl p-5" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: theme.text }}>{ref.refereeName}</p>
                    <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
                      {ref.refereePhone} · Referred {new Date(ref.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {ref.refereeNote && <p className="text-xs mt-1 italic" style={{ color: theme.textFaint }}>"{ref.refereeNote}"</p>}
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

function NotificationBell({ candidateId, theme }: { candidateId: number; theme: Theme }) {
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
        className="relative p-2 rounded-lg transition-all"
        style={{ background: theme.toggleBg, color: theme.toggleText }}
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
          className="absolute right-0 top-10 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: theme.notifBg, border: `1px solid ${theme.surfaceBorder}` }}
        >
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.surfaceBorder}` }}>
            <p className="font-semibold text-sm" style={{ color: theme.text }}>Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {(notifications as NotifItem[]).length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: theme.textFaint }}>No notifications yet</p>
            ) : (
              (notifications as NotifItem[]).map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3"
                  style={{
                    borderBottom: `1px solid ${theme.surfaceBorder}`,
                    background: !n.isRead ? theme.notifUnread : "transparent",
                  }}
                >
                  <p className="text-sm" style={{ color: theme.textMuted }}>{n.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
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

function SectionTitle({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return <h2 className="text-base font-semibold" style={{ color: theme.textMuted }}>{children}</h2>;
}

function EmptyState({ icon, title, subtitle, theme }: { icon: React.ReactNode; title: string; subtitle: string; theme: Theme }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      {icon}
      <p className="font-medium text-sm" style={{ color: theme.textMuted }}>{title}</p>
      <p className="text-xs max-w-xs" style={{ color: theme.textFaint }}>{subtitle}</p>
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
