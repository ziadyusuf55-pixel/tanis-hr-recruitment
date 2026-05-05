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
  Briefcase,
  FileText,
  Wallet,
  Calendar,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Star,
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

type Tab = "profile" | "payroll" | "requests" | "referrals" | "documents" | "payment" | "comments";

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
    { id: "documents", label: "Documents", icon: <FileText className="w-4 h-4" /> },
    { id: "payment", label: "Payment", icon: <Wallet className="w-4 h-4" /> },
    { id: "referrals", label: "Refer", icon: <Users className="w-4 h-4" /> },
    { id: "comments", label: "Comments", icon: <Bell className="w-4 h-4" /> },
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
            <p className="text-white/60 text-[10px] uppercase tracking-wider">Agent ID</p>
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
        {activeTab === "documents" && <DocumentsTab theme={theme} />}
        {activeTab === "payment" && <PaymentMethodsTab theme={theme} />}
        {activeTab === "referrals" && <ReferralTab referrerCandidateId={agent.candidateId} theme={theme} />}
        {activeTab === "comments" && <AgentCommentsTab theme={theme} />}
      </main>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function ProfileTab({ agent, theme }: { agent: AgentData; theme: Theme }) {
  const { data: wfProfile } = trpc.workforce.getMyProfile.useQuery();
  const joinDate = wfProfile?.joinDate
    ? formatDate(new Date(wfProfile.joinDate as number))
    : agent.batch?.assignedAt
    ? formatDate(new Date(agent.batch.assignedAt))
    : "—";
  const wfFields = wfProfile ? [
    { label: "Agent ID", value: wfProfile.traineeCode as string },
    { label: "Full Name", value: wfProfile.fullName as string },
    { label: "Alias / English Name", value: (wfProfile.alias as string | null) ?? "—" },
    { label: "Campaign", value: (wfProfile.campaignName as string | null) ?? "—" },
    { label: "Join Date", value: joinDate },
    { label: "Shift Hours", value: (wfProfile.shiftHours as string | null) ?? "—" },
    { label: "Team Leader", value: (wfProfile.teamLeader as string | null) ?? "—" },
    { label: "Off Day 1", value: wfProfile.offDay1 != null ? DAY_NAMES_FULL[wfProfile.offDay1 as number] : "—" },
    { label: "Off Day 2", value: wfProfile.offDay2 != null ? DAY_NAMES_FULL[wfProfile.offDay2 as number] : "—" },
    { label: "Phone", value: (wfProfile.phone as string | null) ?? "—" },
    { label: "Email", value: (wfProfile.email as string | null) ?? "—" },
  ] : [
    { label: "Full Name", value: agent.name },
    { label: "Agent ID", value: agent.traineeCode },
    { label: "Position", value: agent.positionApplied },
    { label: "Join Date", value: joinDate },
    { label: "Phone", value: agent.phone ?? "—" },
    { label: "Email", value: agent.email ?? "—" },
  ];
  return (
    <div className="space-y-6">
      {wfProfile && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "oklch(0.32 0.18 28 / 0.15)", border: "1px solid oklch(0.32 0.18 28 / 0.3)" }}>
          <Briefcase className="w-5 h-5 shrink-0" style={{ color: BRAND_LIGHT }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Operations Agent</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>You are part of the active workforce. Your profile is managed by your team leader.</p>
          </div>
        </div>
      )}
      <SectionTitle theme={theme}>{wfProfile ? "My Operations Profile" : "My Information"}</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wfFields.map(({ label, value }) => (
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
      {!wfProfile && agent.batch && (
        <>
          <SectionTitle theme={theme}>Training Info</SectionTitle>
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
  hr_letter: "HR Letter",
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
    hrLetterPurpose: "",
    hrLetterLanguage: "" as "arabic" | "english" | "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const needsDate = DATE_REQUIRED_TYPES.includes(form.type);
  const isMultiDate = MULTI_DATE_TYPES.includes(form.type);
  const isHrLetter = form.type === "hr_letter";
  function resetForm() {
    setForm({ type: "", subject: "", message: "", requestedDate: "", requestedDates: [], attachmentUrl: "", attachmentName: "", hrLetterPurpose: "", hrLetterLanguage: "" });
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
    if (isHrLetter) {
      if (!form.hrLetterPurpose.trim()) { toast.error("Please describe the purpose of the HR letter"); return; }
      if (!form.hrLetterLanguage) { toast.error("Please select the letter language"); return; }
    }
    submitMutation.mutate({
      type: form.type as "leave" | "salary" | "schedule" | "complaint" | "resignation" | "day_off" | "sick_note" | "hr_letter" | "other",
      subject: form.subject.trim(),
      message: form.message.trim(),
      requestedDate: (!isMultiDate && form.requestedDate) ? new Date(form.requestedDate).getTime() : undefined,
      requestedDates: (isMultiDate && form.requestedDates.length > 0) ? form.requestedDates : undefined,
      attachmentUrl: form.attachmentUrl || undefined,
      hrLetterPurpose: isHrLetter ? form.hrLetterPurpose.trim() : undefined,
      hrLetterLanguage: isHrLetter && form.hrLetterLanguage ? form.hrLetterLanguage : undefined,
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
                <SelectItem value="hr_letter">HR Letter</SelectItem>
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

          {isHrLetter && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Purpose of HR Letter <span className="normal-case" style={{ color: theme.textFaint }}>(e.g. bank account, visa, embassy)</span></Label>
                <Input placeholder="Describe the purpose..." value={form.hrLetterPurpose} onChange={(e) => setForm((f) => ({ ...f, hrLetterPurpose: e.target.value }))} style={inputStyle} className="placeholder:text-gray-400" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>Letter Language</Label>
                <Select value={form.hrLetterLanguage} onValueChange={(v) => setForm((f) => ({ ...f, hrLetterLanguage: v as "arabic" | "english" }))}>
                  <SelectTrigger style={inputStyle}>
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arabic">Arabic</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
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
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none" aria-hidden>
                      {n.type === "campaign_assigned" ? "🎯" : n.type === "request_reply" ? "📋" : n.type === "referral_update" ? "👥" : "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: theme.textMuted }}>{n.message}</p>
                      <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
                        {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND }} />
                    )}
                  </div>
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


// ─── Documents Tab ────────────────────────────────────────────────────────────
type DocItem = {
  id: number;
  traineeCode: string;
  docType: string;
  fileUrl: string;
  fileName: string | null;
  status: "pending" | "approved" | "rejected";
  adminComment: string | null;
  uploadedAt: Date;
  updatedAt: Date;
};
const DOC_LABELS: Record<string, string> = {
  national_id: "صورة بطاقة الرقم القومي (سارية)",
  qualification: "شهادة المؤهل / بيان قيد",
  cv: "CV",
  personal_photos: "2–6 صور شخصية",
  military_status: "موقف التجنيد (للذكور)",
  insurance_status: "موقف التأمينات",
  criminal_record: "فيش جنائي",
};
const REQUIRED_DOCS = Object.keys(DOC_LABELS);
function DocumentsTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.documents.listMine.useQuery();
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => utils.documents.listMine.invalidate(),
  });
  const [uploading, setUploading] = useState<string | null>(null);
  async function handleUpload(docType: string, file: File) {
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-doc", { method: "POST", body: formData });
      const { url } = await res.json() as { url: string };
      await uploadMutation.mutateAsync({ docType, fileUrl: url });
    } catch {
      // ignore
    } finally {
      setUploading(null);
    }
  }
  const docMap = new Map((docs as unknown as DocItem[]).map((d) => [d.docType, d]));
  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: "oklch(0.32 0.18 28 / 0.12)", border: "1px solid oklch(0.32 0.18 28 / 0.25)" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: theme.text }}>Required Documents for Contract</p>
        <p className="text-xs" style={{ color: theme.textMuted }}>
          Please upload all required documents below so we can prepare your employment contract. All documents must be clear and valid.
        </p>
      </div>
      <div className="space-y-3">
        {REQUIRED_DOCS.map((docType) => {
          const doc = docMap.get(docType);
          const isUploading = uploading === docType;
          return (
            <div
              key={docType}
              className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {doc?.status === "approved" ? (
                  <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />
                ) : doc?.status === "rejected" ? (
                  <XCircle className="w-5 h-5 shrink-0 text-red-500" />
                ) : doc ? (
                  <Clock className="w-5 h-5 shrink-0 text-yellow-500" />
                ) : (
                  <FileText className="w-5 h-5 shrink-0" style={{ color: theme.textFaint }} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: theme.text }}>{DOC_LABELS[docType]}</p>
                  {doc?.adminComment && (
                    <p className="text-xs mt-0.5" style={{ color: doc.status === "rejected" ? "#ef4444" : theme.textMuted }}>
                      {doc.adminComment}
                    </p>
                  )}
                  {doc && !doc.adminComment && (
                    <p className="text-xs mt-0.5 capitalize" style={{ color: doc.status === "approved" ? "#22c55e" : doc.status === "rejected" ? "#ef4444" : "#eab308" }}>
                      {doc.status === "approved" ? "Approved" : doc.status === "rejected" ? "Rejected" : "Pending Review"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
                    View
                  </a>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(docType, f); e.target.value = ""; }}
                    disabled={isUploading}
                  />
                  <span
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{ background: BRAND, color: "white", opacity: isUploading ? 0.6 : 1 }}
                  >
                    {isUploading ? <Clock className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {doc ? "Re-upload" : "Upload"}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }} />
        </div>
      )}
    </div>
  );
}
// ─── Payment Methods Tab ──────────────────────────────────────────────────────
type PaymentItem = {
  id: number;
  traineeCode: string;
  type: "wallet" | "bank";
  walletProvider: "vodafone_cash" | "orange_cash" | null;
  walletPhone: string | null;
  walletName: string | null;
  bankName: string | null;
  bankAccountOrPhone: string | null;
  bankFullName: string | null;
  isPreferred: boolean;
  adminComment: string | null;
  createdAt: Date;
  updatedAt: Date;
};
const EGYPT_BANKS = [
  "Banque Misr","National Bank of Egypt","Commercial International Bank (CIB)",
  "Banque du Caire","Arab African International Bank","QNB Al Ahli",
  "HSBC Egypt","Faisal Islamic Bank","Arab Bank","Attijariwafa Bank Egypt",
  "Bank of Alexandria","Egyptian Gulf Bank","Suez Canal Bank","Al Baraka Bank Egypt",
  "Abu Dhabi Islamic Bank","Mashreq Bank Egypt","Société Arabe Internationale de Banque (SAIB)",
  "Credit Agricole Egypt","United Bank","Export Development Bank of Egypt","Other",
];
function PaymentMethodsTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: methods = [], isLoading } = trpc.paymentMethods.listMine.useQuery();
  const addMutation = trpc.paymentMethods.upsert.useMutation({
    onSuccess: () => { utils.paymentMethods.listMine.invalidate(); setShowForm(false); resetForm(); },
  });
  const setPreferredMutation = trpc.paymentMethods.setPreferred.useMutation({
    onSuccess: () => utils.paymentMethods.listMine.invalidate(),
  });
  const deleteMutation = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => utils.paymentMethods.listMine.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"wallet" | "bank">("wallet");
  const [provider, setProvider] = useState("Vodafone Cash");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState(EGYPT_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [holderName, setHolderName] = useState("");
  function resetForm() {
    setFormType("wallet"); setProvider("Vodafone Cash"); setPhone(""); setBankName(EGYPT_BANKS[0]);
    setAccountNumber(""); setAccountPhone(""); setHolderName("");
  }
  async function handleAdd() {
    await addMutation.mutateAsync({
      type: formType,
      walletProvider: formType === "wallet" ? (provider === "Vodafone Cash" ? "vodafone_cash" : "orange_cash") : undefined,
      walletPhone: formType === "wallet" ? phone : undefined,
      walletName: formType === "wallet" ? holderName : undefined,
      bankName: formType === "bank" ? bankName : undefined,
      bankAccountOrPhone: formType === "bank" ? (accountNumber || accountPhone || undefined) : undefined,
      bankFullName: formType === "bank" ? holderName : undefined,
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle theme={theme}>Payment Methods</SectionTitle>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: BRAND, color: "white" }}
        >
          + Add Method
        </button>
      </div>
      {showForm && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>New Payment Method</p>
          <div className="flex gap-2">
            {(["wallet", "bank"] as const).map((t) => (
              <button key={t} onClick={() => setFormType(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
                style={{ background: formType === t ? BRAND : theme.surfaceBorder, color: formType === t ? "white" : theme.textMuted }}>
                {t === "wallet" ? "Wallet" : "Bank Account"}
              </button>
            ))}
          </div>
          {formType === "wallet" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  <option>Vodafone Cash</option>
                  <option>Orange Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Full Name (as registered)</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
            </div>
          )}
          {formType === "bank" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Bank Name</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {EGYPT_BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Account Number (optional)</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Phone Number (optional)</label>
                <input value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Full Name (account holder)</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={addMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: BRAND, color: "white" }}>
              {addMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND_LIGHT, borderTopColor: "transparent" }} />
        </div>
      ) : (methods as unknown as PaymentItem[]).length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" style={{ color: theme.textFaint }} />}
          title="No payment methods yet" subtitle="Add a wallet or bank account to receive your salary." theme={theme} />
      ) : (
        <div className="space-y-3">
          {(methods as unknown as PaymentItem[]).map((m) => (
            <div key={m.id} className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${m.isPreferred ? "oklch(0.32 0.18 28 / 0.5)" : theme.surfaceBorder}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "22" }}>
                    {m.type === "wallet" ? <Wallet className="w-4 h-4" style={{ color: BRAND_LIGHT }} /> : <CreditCard className="w-4 h-4" style={{ color: BRAND_LIGHT }} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: theme.text }}>
                        {m.type === "wallet" ? (m.walletProvider === "vodafone_cash" ? "Vodafone Cash" : m.walletProvider === "orange_cash" ? "Orange Cash" : "Wallet") : (m.bankName ?? "Bank Account")}
                      </p>
                      {m.isPreferred && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>Preferred</span>}
                    </div>
                    <p className="text-xs" style={{ color: theme.textMuted }}>
                      {m.type === "wallet" ? m.walletPhone : (m.bankAccountOrPhone ?? "—")} · {m.type === "wallet" ? m.walletName : m.bankFullName}
                    </p>
                    {m.adminComment && (
                      <p className="text-xs mt-1 italic" style={{ color: "#eab308" }}>Admin note: {m.adminComment}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!m.isPreferred && (
                    <button onClick={() => setPreferredMutation.mutate({ id: m.id })}
                      className="text-xs px-2 py-1 rounded-lg" style={{ background: theme.surfaceBorder, color: theme.textMuted }}>
                      Set Preferred
                    </button>
                  )}
                  <button onClick={() => { if (confirm("Remove this payment method?")) deleteMutation.mutate({ id: m.id }); }}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: "#ef444422", color: "#ef4444" }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Operation Plan Tab ───────────────────────────────────────────────────────
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type WfAgent = {
  id: number;
  traineeCode: string;
  fullName: string;
  alias: string | null;
  offDay1: number | null;
  offDay2: number | null;
  campaignId: number | null;
};
type ScReq = {
  id: number;
  requesterCode: string;
  targetCode: string;
  requesterNewOff1: number | null;
  requesterNewOff2: number | null;
  targetNewOff1: number | null;
  targetNewOff2: number | null;
  message: string | null;
  status: string;
  createdAt: Date | number;
};
function OperationPlanTab({ theme }: { theme: Theme }) {
  const utils = trpc.useUtils();
  const { data: myProfile } = trpc.workforce.getMyProfile.useQuery();
  const campaignId = myProfile?.campaignId as number | null | undefined;
  const myCode = myProfile?.traineeCode as string | undefined;
  const { data: agents = [] } = trpc.workforce.getCampaignAgents.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );
  const { data: myRequests = [] } = trpc.scheduleChange.listMine.useQuery();
  const createRequest = trpc.scheduleChange.request.useMutation({
    onSuccess: () => { utils.scheduleChange.listMine.invalidate(); setShowForm(false); resetForm(); },
  });
  const peerApprove = trpc.scheduleChange.peerApprove.useMutation({
    onSuccess: () => utils.scheduleChange.listMine.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [targetCode, setTargetCode] = useState("");
  const [reqOff1, setReqOff1] = useState<number>(0);
  const [reqOff2, setReqOff2] = useState<number>(1);
  const [tgtOff1, setTgtOff1] = useState<number>(0);
  const [tgtOff2, setTgtOff2] = useState<number>(1);
  const [msg, setMsg] = useState("");
  function resetForm() { setTargetCode(""); setReqOff1(0); setReqOff2(1); setTgtOff1(0); setTgtOff2(1); setMsg(""); }
  const typedAgents = agents as unknown as WfAgent[];
  const typedRequests = myRequests as unknown as ScReq[];
  const pendingPeerApproval = typedRequests.filter(r => r.targetCode === myCode && r.status === "pending_peer");
  const myOutgoing = typedRequests.filter(r => r.requesterCode === myCode);
  if (!myProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Calendar className="w-10 h-10" style={{ color: theme.textFaint }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>You are not yet assigned to an operations campaign.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {/* Weekly Schedule Grid */}
      <div>
        <SectionTitle theme={theme}>Campaign Weekly Schedule</SectionTitle>
        <p className="text-xs mb-4" style={{ color: theme.textMuted }}>
          Green = Working day &nbsp;·&nbsp; Red = Off day &nbsp;·&nbsp; Your row is highlighted.
        </p>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.surfaceBorder}` }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: theme.surface }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: theme.text, minWidth: 140 }}>Agent</th>
                  {DAY_SHORT.map(d => (
                    <th key={d} className="px-3 py-3 font-semibold text-center" style={{ color: theme.text, minWidth: 52 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {typedAgents.map((a, i) => {
                  const isMe = a.traineeCode === myCode;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        background: isMe ? "oklch(0.32 0.18 28 / 0.12)" : i % 2 === 0 ? theme.bg : theme.surface,
                        borderTop: `1px solid ${theme.surfaceBorder}`,
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>You</span>}
                          <span className="font-medium truncate" style={{ color: theme.text }}>{a.alias ?? a.fullName}</span>
                        </div>
                      </td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const isOff = a.offDay1 === day || a.offDay2 === day;
                        return (
                          <td key={day} className="px-3 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                              style={{
                                background: isOff ? "#ef444422" : "#22c55e22",
                                color: isOff ? "#ef4444" : "#22c55e",
                              }}
                            >
                              {isOff ? "Off" : "On"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Pending peer approval requests */}
      {pendingPeerApproval.length > 0 && (
        <div>
          <SectionTitle theme={theme}>Pending Your Approval</SectionTitle>
          <div className="space-y-3">
            {pendingPeerApproval.map(r => (
              <div key={r.id} className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid oklch(0.85 0.18 85 / 0.4)` }}>
                <p className="text-sm font-medium mb-1" style={{ color: theme.text }}>
                  <span style={{ color: BRAND_LIGHT }}>{r.requesterCode}</span> wants to swap schedules with you.
                </p>
                {r.message && <p className="text-xs mb-3 italic" style={{ color: theme.textMuted }}>"{r.message}"</p>}
                <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                  Their new off days: {r.requesterNewOff1 != null ? DAY_SHORT[r.requesterNewOff1] : "—"} & {r.requesterNewOff2 != null ? DAY_SHORT[r.requesterNewOff2] : "—"} &nbsp;·&nbsp;
                  Your new off days: {r.targetNewOff1 != null ? DAY_SHORT[r.targetNewOff1] : "—"} & {r.targetNewOff2 != null ? DAY_SHORT[r.targetNewOff2] : "—"}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => peerApprove.mutate({ id: r.id, approve: true })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#22c55e22", color: "#22c55e" }}>
                    Approve
                  </button>
                  <button onClick={() => peerApprove.mutate({ id: r.id, approve: false })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#ef444422", color: "#ef4444" }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* My outgoing requests */}
      {myOutgoing.length > 0 && (
        <div>
          <SectionTitle theme={theme}>My Schedule Change Requests</SectionTitle>
          <div className="space-y-2">
            {myOutgoing.map(r => (
              <div key={r.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>Swap with {r.targetCode}</p>
                  <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                    New off days: {r.requesterNewOff1 != null ? DAY_SHORT[r.requesterNewOff1] : "—"} & {r.requesterNewOff2 != null ? DAY_SHORT[r.requesterNewOff2] : "—"}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{
                  background: r.status === "approved" ? "#22c55e22" : r.status === "rejected" ? "#ef444422" : "#eab30822",
                  color: r.status === "approved" ? "#22c55e" : r.status === "rejected" ? "#ef4444" : "#eab308",
                }}>
                  {r.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Request schedule change form */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle theme={theme}>Request Schedule Change</SectionTitle>
          <button onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: BRAND, color: "white" }}>
            {showForm ? "Cancel" : "+ New Request"}
          </button>
        </div>
        {showForm && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Select the agent you want to swap schedules with, then specify the new off days for both of you. The other agent must approve first, then the manager will review.
            </p>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Agent to swap with</label>
              <select value={targetCode} onChange={e => setTargetCode(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                <option value="">Select agent...</option>
                {typedAgents.filter(a => a.traineeCode !== myCode).map(a => (
                  <option key={a.traineeCode} value={a.traineeCode}>{a.alias ?? a.fullName} ({a.traineeCode})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Your new off day 1</label>
                <select value={reqOff1} onChange={e => setReqOff1(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Your new off day 2</label>
                <select value={reqOff2} onChange={e => setReqOff2(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Their new off day 1</label>
                <select value={tgtOff1} onChange={e => setTgtOff1(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Their new off day 2</label>
                <select value={tgtOff2} onChange={e => setTgtOff2(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }}>
                  {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: theme.textFaint }}>Message (optional)</label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} placeholder="Reason for schedule change..."
                className="w-full rounded-lg px-3 py-2 text-sm border resize-none" style={{ background: theme.bg, color: theme.text, borderColor: theme.surfaceBorder }} />
            </div>
            <button
              onClick={() => createRequest.mutate({ targetCode, requesterNewOff1: reqOff1, requesterNewOff2: reqOff2, targetNewOff1: tgtOff1, targetNewOff2: tgtOff2, message: msg || undefined })}
              disabled={!targetCode || createRequest.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: BRAND, color: "white" }}
            >
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        )}
      </div>
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

// ─── Agent Comments Tab (read-only for agents) ────────────────────────────────
const COMMENT_TAG_CONFIG = {
  note:     { label: "Note",     color: "bg-blue-500/20 text-blue-400",    border: "border-blue-500/30" },
  warning:  { label: "Warning",  color: "bg-amber-500/20 text-amber-400",  border: "border-amber-500/30" },
  resolved: { label: "Resolved", color: "bg-emerald-500/20 text-emerald-400", border: "border-emerald-500/30" },
};

function AgentCommentsTab({ theme }: { theme: Theme }) {
  const { data: comments = [], isLoading } = trpc.agentComments.listMine.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: theme.surface }} />
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-16">
        <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: theme.textFaint }} />
        <p className="font-medium" style={{ color: theme.text }}>No comments yet</p>
        <p className="text-sm mt-1" style={{ color: theme.textMuted }}>Your manager will post notes or feedback here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
        Comments and feedback from your management team.
      </p>
      {comments.map((c) => {
        const tag = c.tag as keyof typeof COMMENT_TAG_CONFIG;
        const cfg = COMMENT_TAG_CONFIG[tag] ?? COMMENT_TAG_CONFIG.note;
        return (
          <div
            key={c.id}
            className="rounded-xl p-4 border"
            style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </span>
              <span className="text-xs" style={{ color: theme.textMuted }}>from {c.adminName}</span>
              <span className="text-xs" style={{ color: theme.textFaint }}>
                {new Date(c.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: theme.text }}>{c.content}</p>
          </div>
        );
      })}
    </div>
  );
}
