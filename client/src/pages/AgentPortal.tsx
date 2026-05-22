import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
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
  LayoutGrid,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  TrendingUp,
  Activity,
  AlertCircle,
  BarChart2,
  Zap,
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

type Tab = "profile" | "opplan" | "cycle" | "payroll" | "requests" | "referrals" | "documents" | "payment" | "comments";

export default function AgentPortal() {
  const [, navigate] = useLocation();
  const { data: agent, isLoading, isFetching } = trpc.agent.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const logoutMutation = trpc.agent.logout.useMutation();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const markOrientationMutation = trpc.orientation.markShown.useMutation();
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
    if (!isLoading && !isFetching && !agent) {
      navigate("/login");
    }
  }, [isLoading, isFetching, agent, navigate]);

    // Auto-mark orientation shown on first visit (no popup)
  const { data: orientationData } = trpc.orientation.getStatus.useQuery(
    undefined,
    { enabled: !!agent }
  );
  useEffect(() => {
    if (orientationData && !orientationData.shown) {
      markOrientationMutation.mutate(undefined);
    }
  }, [orientationData]);
  async function handleLogout() {
    await logoutMutation.mutateAsync();
    navigate("/login");
  }

  if (isLoading || isFetching) {
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
    { id: "opplan", label: "Op Plan", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "cycle", label: "Cycle", icon: <Activity className="w-4 h-4" /> },
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
        {activeTab === "opplan" && <OperationPlanTab theme={theme} />}
        {activeTab === "cycle" && <CycleTrackerTab theme={theme} />}
        {activeTab === "payroll" && <PayrollTab theme={theme} />}
        {activeTab === "requests" && <RequestCenterTab candidateId={agent.candidateId} theme={theme} />}
        {activeTab === "documents" && <DocumentsTab theme={theme} />}
        {activeTab === "payment" && <PaymentMethodsTab theme={theme} />}
        {activeTab === "referrals" && <ReferralTab referrerCandidateId={agent.candidateId} theme={theme} />}
        {activeTab === "comments" && <AgentCommentsTab theme={theme} />}
      </main>


    </div>
  );
}

/// ─── Shared Types ─────────────────────────────────────────────────────
type AgentData = {
  candidateId: number;
  fullName?: string;
  name?: string;
  email: string | null;
  phone: string | null;
  traineeCode?: string;
  positionApplied?: string | null;
  batch?: { assignedAt: number | Date | null } | null;
};
const COMMENT_TAG_CONFIG = {
  note:     { label: "Note",     color: "bg-blue-500/20 text-blue-400",    border: "border-blue-500/30" },
  warning:  { label: "Warning",  color: "bg-amber-500/20 text-amber-400",  border: "border-amber-500/30" },
  resolved: { label: "Resolved", color: "bg-emerald-500/20 text-emerald-400", border: "border-emerald-500/30" },
};
// ─── Profile Tab ──────────────────────────────────────────────────────
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
    { label: "Phone", value: (wfProfile.phone as string | null) ?? "—" },
    { label: "Email", value: (wfProfile.email as string | null) ?? "—" },
    { label: "CRDTS", value: (wfProfile.crdts as string | null) ?? "—" },
    { label: "Campaign", value: (wfProfile.campaignName as string | null) ?? "—" },
    { label: "Join Date", value: joinDate },
    { label: "Team Leader", value: (wfProfile.teamLeader as string | null) ?? "—" },
    { label: "Off Day 1", value: wfProfile.offDay1 != null ? DAY_NAMES_FULL[wfProfile.offDay1 as number] : "—" },
    { label: "Off Day 2", value: wfProfile.offDay2 != null ? DAY_NAMES_FULL[wfProfile.offDay2 as number] : "—" },
  ] : [
    { label: "Full Name", value: agent.name },
    { label: "Agent ID", value: agent.traineeCode },
    { label: "Position", value: agent.positionApplied },
    { label: "Join Date", value: joinDate },
    { label: "Phone", value: agent.phone ?? "—" },
    { label: "Email", value: agent.email ?? "—" },
  ];
   // Break schedule for current week
  const today = new Date();
  const weekSunday = new Date(today);
  weekSunday.setDate(today.getDate() - today.getDay());
  const weekSaturday = new Date(weekSunday);
  weekSaturday.setDate(weekSunday.getDate() + 6);
  const bsStart = weekSunday.toISOString().slice(0, 10);
  const bsEnd = weekSaturday.toISOString().slice(0, 10);
  const { data: myBreaks = [] } = trpc.breakSchedule.getMyBreaks.useQuery(
    { startDate: bsStart, endDate: bsEnd },
    { enabled: !!wfProfile }
  );
  // Operation plan for current week
  const [opWeekOffset, setOpWeekOffset] = useState(0);
  const { data: myOpPlan } = trpc.workforce.getMyOperationPlan.useQuery(
    { weekOffset: opWeekOffset },
    { enabled: !!wfProfile }
  );

  function to12h(time24: string): string {
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr ?? "00";
    const ampm = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
  }

  // Day offs from wfProfile
  const offDays: string[] = [];
  if (wfProfile?.offDay1 != null) offDays.push(DAY_NAMES_FULL[wfProfile.offDay1 as number]);
  if (wfProfile?.offDay2 != null) offDays.push(DAY_NAMES_FULL[wfProfile.offDay2 as number]);

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

      {wfProfile && (
        <>
          {/* Campaign & Day Offs row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campaign card */}
            <div className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: theme.textFaint }}>Campaign</p>
              </div>
              <p className="font-semibold text-base" style={{ color: theme.text }}>
                {(wfProfile.campaignName as string | null) ?? "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>Your active campaign assignment</p>
            </div>
            {/* Day Offs card */}
            <div className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: theme.textFaint }}>Day Offs</p>
              </div>
              {offDays.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {offDays.map(d => (
                    <span key={d} className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: "oklch(0.32 0.18 28 / 0.15)", color: BRAND_LIGHT }}>{d}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: theme.textMuted }}>No day offs assigned</p>
              )}
            </div>
          </div>

          {/* Operation Plan card */}
          {myOpPlan && (() => {
            const weekLabel = (() => {
              const d = new Date(myOpPlan.weekStart + "T00:00:00");
              const end = new Date(d); end.setDate(d.getDate() + 6);
              return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
            })();
            return (
              <div className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
                    <p className="text-xs uppercase tracking-wider font-medium" style={{ color: theme.textFaint }}>My Operation Plan</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setOpWeekOffset(o => o - 1)} className="p-1 rounded-lg transition-all hover:opacity-70" style={{ color: theme.textMuted }}>◀</button>
                    <span className="text-xs font-medium px-2" style={{ color: theme.text }}>{weekLabel}</span>
                    <button onClick={() => setOpWeekOffset(o => o + 1)} className="p-1 rounded-lg transition-all hover:opacity-70" style={{ color: theme.textMuted }}>▶</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {myOpPlan.days.map(day => {
                    const isWork = day.status === "work";
                    return (
                      <div key={day.date} className="rounded-lg p-2 text-center" style={{ background: isWork ? "oklch(0.32 0.18 28 / 0.15)" : (theme === DARK ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"), border: `1px solid ${isWork ? "oklch(0.32 0.18 28 / 0.3)" : theme.surfaceBorder}` }}>
                        <p className="text-[10px] font-medium mb-1" style={{ color: theme.textFaint }}>{day.label}</p>
                        <p className="text-xs font-bold" style={{ color: isWork ? BRAND_LIGHT : theme.textMuted }}>{isWork ? "Work" : "Off"}</p>
                      </div>
                    );
                  })}
                </div>
                {myOpPlan.shiftHours && (
                  <p className="text-xs mt-2" style={{ color: theme.textMuted }}>Shift: {myOpPlan.shiftHours as string}</p>
                )}
              </div>
            );
          })()}

          {/* Break Schedule card */}
          <div className="rounded-xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: BRAND_LIGHT }} />
              <p className="text-xs uppercase tracking-wider font-medium" style={{ color: theme.textFaint }}>This Week's Break Schedule</p>
            </div>
            {(myBreaks as Array<{ date: string; breakStart: string; breakEnd: string }>).length === 0 ? (
              <p className="text-sm" style={{ color: theme.textMuted }}>No break schedule set for this week</p>
            ) : (() => {
              // Group breaks by date (multiple slots per day)
              const grouped: Record<string, Array<{ breakStart: string; breakEnd: string }>> = {};
              for (const b of myBreaks as Array<{ date: string; breakStart: string; breakEnd: string }>) {
                if (!grouped[b.date]) grouped[b.date] = [];
                grouped[b.date].push({ breakStart: b.breakStart, breakEnd: b.breakEnd });
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, slots]) => {
                    const d = new Date(date + "T00:00:00");
                    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <div key={date} className="rounded-lg p-3" style={{ background: theme.cardBg, border: `1px solid ${theme.surfaceBorder}` }}>
                        <p className="text-xs font-medium mb-2" style={{ color: theme.textMuted }}>{dayLabel}</p>
                        <div className="space-y-1">
                          {slots.map((slot, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className="text-xs rounded px-1.5 py-0.5 font-medium" style={{ background: "oklch(0.32 0.18 28 / 0.15)", color: BRAND_LIGHT }}>{i + 1}</span>
                              <span className="text-sm font-semibold" style={{ color: theme.text }}>{to12h(slot.breakStart)}</span>
                              <span className="text-xs" style={{ color: theme.textFaint }}>– {to12h(slot.breakEnd)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Payroll Tab ─────────────────────────────────────────────────────────────

function PayrollTab({ theme }: { payroll?: unknown; theme: Theme }) {
  const { data: months = [], isLoading: loadingMonths } = trpc.payrollV2.getMyMonthsFromCookie.useQuery();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? months[0] ?? null;
  const monthIndex = months.indexOf(activeMonth ?? "");
  const { data: record, isLoading: loadingRecord } = trpc.payrollV2.getMyRecordFromCookie.useQuery(
    { month: activeMonth! },
    { enabled: !!activeMonth }
  );

  const prevMonth = monthIndex < months.length - 1 ? months[monthIndex + 1] : null;
  const nextMonth = monthIndex > 0 ? months[monthIndex - 1] : null;

  function formatMonthLabel(m: string) {
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  function fmtEGP(val: string | number | null | undefined): string {
    if (val === null || val === undefined || val === "") return "—";
    const n = typeof val === "number" ? val : parseFloat(val);
    return isNaN(n) ? "—" : `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  function fmtNum(val: string | number | null | undefined, suffix = ""): string {
    if (val === null || val === undefined || val === "") return "—";
    const n = typeof val === "number" ? val : parseFloat(val as string);
    if (isNaN(n)) return "—";
    return n > 0 ? `${n.toLocaleString("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${suffix}` : "—";
  }

  if (loadingMonths) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: theme.cardBg }} />)}</div>;
  }

  if (months.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard className="w-8 h-8" style={{ color: theme.textFaint }} />}
        title="No payroll records yet"
        subtitle="Your salary details will appear here once processed by HR."
        theme={theme}
      />
    );
  }

  const r = record as {
    month: string;
    crdts: string | null;
    alias: string | null;
    baseSalary: string | null;
    workingHours: string | null;
    ot1x5Hours: string | null;
    ot2xHours: string | null;
    ot3xHours: string | null;
    commissionEgp: string | null;
    qualityDeductions: string | null;
    attendanceDeductions: string | null;
    totalDeductions: string | null;
    netPay: string | null;
    qualityDetail: string | null;
    attendanceDetail: string | null;
    paymentStatus: string | null;
    paymentDate: number | null;
    coachingBonus?: string | null;
  } | null | undefined;

  return (
    <div className="space-y-4">
      {/* Inline help message */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <CreditCard className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: theme.text }}>Your Payroll</p>
          <p className="text-xs leading-relaxed" style={{ color: theme.textFaint }}>This tab shows your monthly salary breakdown — base pay, overtime (1.5×, 2×, 3×), commissions, and any deductions. Use the arrows to browse previous months. Payment status shows whether your salary has been processed.</p>
        </div>
      </div>
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button disabled={!prevMonth} onClick={() => setSelectedMonth(prevMonth!)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 text-lg"
          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8249;</button>
        <span className="text-base font-semibold min-w-[160px] text-center" style={{ color: theme.text }}>
          {activeMonth ? formatMonthLabel(activeMonth) : "—"}
        </span>
        <button disabled={!nextMonth} onClick={() => setSelectedMonth(nextMonth!)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 text-lg"
          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8250;</button>
      </div>

      {loadingRecord ? (
        <div className="h-48 rounded-xl animate-pulse" style={{ background: theme.cardBg }} />
      ) : !r ? (
        <EmptyState icon={<CreditCard className="w-8 h-8" style={{ color: theme.textFaint }} />}
          title="No record for this month" subtitle="Your payroll for this period has not been uploaded yet." theme={theme} />
      ) : (
        <div className="space-y-3">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: theme.textMuted }}>{formatMonthLabel(r.month)}</p>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{
              background: r.paymentStatus === "paid" ? "oklch(0.45 0.15 142 / 0.2)" : "oklch(0.65 0.18 55 / 0.2)",
              color: r.paymentStatus === "paid" ? "oklch(0.65 0.15 142)" : "oklch(0.75 0.18 55)",
            }}>{r.paymentStatus === "paid" ? "✓ Paid" : "⏳ Pending"}</span>
          </div>

          {/* Earnings */}
          <div className="rounded-xl overflow-hidden" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textFaint }}>Earnings</p>
            </div>
            <div className="divide-y" style={{ borderColor: theme.cardBorder }}>
              {[
                { label: "Base Salary", value: fmtEGP(r.baseSalary) },
                { label: "Working Hours", value: fmtNum(r.workingHours, " hrs") },
                { label: "OT 1.5×", value: fmtNum(r.ot1x5Hours, " hrs") },
                { label: "OT 2×", value: fmtNum(r.ot2xHours, " hrs") },
                { label: "OT 3×", value: fmtNum(r.ot3xHours, " hrs") },
                { label: "Commission", value: fmtEGP(r.commissionEgp) },
                ...(r.coachingBonus && parseFloat(String(r.coachingBonus)) > 0
                  ? [{ label: "Coaching Bonus", value: fmtEGP(r.coachingBonus) }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm" style={{ color: theme.textMuted }}>{label}</p>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Deductions */}
          <div className="rounded-xl overflow-hidden" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textFaint }}>Deductions</p>
            </div>
            <div className="divide-y" style={{ borderColor: theme.cardBorder }}>
              {([
                { label: "Quality Deductions", value: fmtEGP(r.qualityDeductions), detail: r.qualityDetail, bold: false },
                { label: "Attendance Deductions", value: fmtEGP(r.attendanceDeductions), detail: r.attendanceDetail, bold: false },
                { label: "Total Deductions", value: fmtEGP(r.totalDeductions), detail: null, bold: true },
              ] as Array<{ label: string; value: string; detail: string | null; bold: boolean }>).map(({ label, value, detail, bold }) => (
                <div key={label} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${bold ? "font-semibold" : ""}`} style={{ color: bold ? "#ef4444" : theme.textMuted }}>{label}</p>
                    <p className={`text-sm ${bold ? "font-semibold" : "font-medium"}`} style={{ color: bold ? "#ef4444" : theme.text }}>{value !== "—" ? `- ${value}` : "—"}</p>
                  </div>
                  {detail && <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.textFaint }}>{detail}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Net Pay */}
          <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: "oklch(0.32 0.18 28 / 0.12)", border: "1px solid oklch(0.32 0.18 28 / 0.25)" }}>
            <p className="font-semibold" style={{ color: theme.text }}>Net Pay</p>
            <p className="text-xl font-bold" style={{ color: BRAND_LIGHT }}>{fmtEGP(r.netPay)}</p>
          </div>

          {r.paymentDate && (
            <p className="text-xs text-center" style={{ color: theme.textFaint }}>
              Payment date: {new Date(r.paymentDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Request Center Tab ───────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: "Leave",
  paid_leave: "Paid Leave",
  salary: "Salary Inquiry",
  schedule: "Schedule Change",
  complaint: "General Complaint",
  resignation: "Resignation",
  day_off: "Unpaid Day Off",
  sick_note: "Sick Note",
  hr_letter: "HR Letter",
  other: "Other",
};
const DATE_REQUIRED_TYPES = ["leave", "paid_leave", "day_off", "resignation"];
const MULTI_DATE_TYPES = ["leave", "paid_leave", "day_off"];;

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

function getMinDateStr(type?: string) {
  const d = new Date();
  // Unpaid day off can be requested for any day (including today)
  if (type === "day_off") return d.toISOString().split("T")[0];
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
    onError: (e) => toast.error(getErrorMessage(e)),
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
      toast.error(getErrorMessage(e, "Upload failed"));
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
      type: form.type as "leave" | "paid_leave" | "salary" | "schedule" | "complaint" | "resignation" | "day_off" | "sick_note" | "hr_letter" | "other",
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
      {/* Inline help message */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <MessageSquare className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: theme.text }}>Requests Center</p>
          <p className="text-xs leading-relaxed" style={{ color: theme.textFaint }}>Submit formal requests here — day off, paid leave, HR letter, schedule change, or resignation. Your team leader will review and respond. You can track the status of each request below.</p>
        </div>
      </div>
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
                <SelectItem value="paid_leave">Paid Leave</SelectItem>
                <SelectItem value="day_off">Unpaid Day Off</SelectItem>
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
                Select Dates <span className="normal-case" style={{ color: theme.textFaint }}>{form.type === "day_off" ? "(any date — pick multiple)" : "(min. 2 weeks from today — pick multiple)"}</span>
              </Label>
              <MultiDatePicker selectedDates={form.requestedDates} onToggle={toggleDate} minDate={getMinDateStr(form.type)} theme={theme} />
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
                <span className="ml-1 normal-case" style={{ color: theme.textFaint }}>{form.type === "day_off" ? "(any date)" : "(min. 2 weeks from today)"}</span>
              </Label>
              <Input type="date" min={getMinDateStr(form.type)} value={form.requestedDate} onChange={(e) => setForm((f) => ({ ...f, requestedDate: e.target.value }))} style={inputStyle} />
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
    onError: (e) => toast.error(getErrorMessage(e)),
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
      {/* Inline help message */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: theme.text }}>Documents</p>
          <p className="text-xs leading-relaxed" style={{ color: theme.textFaint }}>Upload your required documents here (National ID, contracts, certificates). HR will review and approve each one. Make sure all files are clear and legible.</p>
        </div>
      </div>
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
  function validateEgyptianPhone(val: string): boolean {
    const digits = val.replace(/\D/g, "");
    return /^01[0125]\d{8}$/.test(digits);
  }
  async function handleAdd() {
    if (formType === "wallet") {
      if (!phone.trim()) { toast.error("Phone number is required"); return; }
      if (!validateEgyptianPhone(phone)) { toast.error("Enter a valid Egyptian mobile number (e.g. 01012345678)"); return; }
      if (!holderName.trim()) { toast.error("Full name is required"); return; }
    } else {
      if (!holderName.trim()) { toast.error("Full name is required"); return; }
      if (accountPhone && !validateEgyptianPhone(accountPhone)) { toast.error("Enter a valid Egyptian mobile number for the phone field (e.g. 01012345678)"); return; }
    }
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
      {/* Inline help message */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <Wallet className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: theme.text }}>Payment Methods</p>
          <p className="text-xs leading-relaxed" style={{ color: theme.textFaint }}>Add your preferred payment method so payroll knows where to send your salary. You can add Instapay, Vodafone Cash, or bank transfer. Mark one as preferred and HR will use it for your monthly payment.</p>
        </div>
      </div>
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



// ─── Operation Plan Tab ──────────────────────────────────────────────────────
type CampaignPlanData = {
  campaignName: string;
  weekStart: string;
  weekDays: { date: string; label: string }[];
  grid: {
    traineeCode: string;
    fullName: string;
    alias: string | null;
    teamLeader: string | null;
    isMe: boolean;
    days: { date: string; label: string; status: "off" | "work" }[];
  }[];
  myCode: string;
};

function OperationPlanTab({ theme }: { theme: Theme }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data: plan, isLoading } = trpc.workforce.getFullCampaignPlan.useQuery({ weekOffset });

  if (isLoading && !plan) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND }} />
      </div>
    );
  }

  if (!plan) {
    return (
      <EmptyState
        icon={<LayoutGrid className="w-8 h-8" style={{ color: theme.textFaint }} />}
        title="No operation plan yet"
        subtitle="Your campaign's operation plan will appear here once set up by your team leader."
        theme={theme}
      />
    );
  }

  const p = plan as CampaignPlanData;

  function formatWeekLabel(dateStr: string) {
    const d = new Date(dateStr);
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  return (
    <div className="space-y-6">
      {/* Inline help */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <LayoutGrid className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: theme.text }}>Campaign Operation Plan</p>
          <p className="text-xs leading-relaxed" style={{ color: theme.textFaint }}>This is the full weekly schedule for your campaign. Green = working day, grey = day off. Use the arrows to browse other weeks.</p>
        </div>
      </div>

      {/* Campaign header + week nav */}
      <div className="rounded-xl p-5 flex items-center justify-between" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <div>
          <h2 className="text-base font-bold" style={{ color: theme.text }}>{p.campaignName}</h2>
          <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>{p.grid.length} agents</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8249;</button>
          <span className="text-xs font-medium min-w-[140px] text-center" style={{ color: theme.textMuted }}>
            {formatWeekLabel(p.weekStart)}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8250;</button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: BRAND, color: "white" }}>Today</button>
          )}
        </div>
      </div>

      {/* Schedule grid */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: theme.cardBg, borderBottom: `1px solid ${theme.cardBorder}` }}>
                <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ color: theme.textFaint, background: theme.cardBg, minWidth: 160 }}>Agent</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: theme.textFaint }}>TL</th>
                {p.weekDays.map(d => (
                  <th key={d.date} className="px-3 py-3 font-semibold text-center" style={{ color: theme.textFaint }}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.grid.map((agent, idx) => (
                <tr
                  key={agent.traineeCode}
                  style={{
                    background: agent.isMe
                      ? `${BRAND}18`
                      : idx % 2 === 0 ? theme.bg : theme.cardBg,
                    borderBottom: `1px solid ${theme.cardBorder}`,
                  }}
                >
                  <td className="px-4 py-2.5 sticky left-0 z-10" style={{ background: agent.isMe ? `${BRAND}18` : idx % 2 === 0 ? theme.bg : theme.cardBg }}>
                    <div className="flex items-center gap-2">
                      {agent.isMe && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: BRAND, color: "white" }}>You</span>}
                      <div>
                        <div className="font-medium" style={{ color: theme.text }}>{agent.fullName}</div>
                        <div style={{ color: theme.textFaint }}>T-{agent.traineeCode}{agent.alias ? ` · ${agent.alias}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: theme.textMuted }}>{agent.teamLeader ?? "—"}</td>
                  {agent.days.map(day => (
                    <td key={day.date} className="px-3 py-2.5 text-center">
                      {day.status === "work" ? (
                        <span className="inline-block w-6 h-6 rounded-full" style={{ background: "oklch(0.55 0.18 145 / 0.25)", border: "1px solid oklch(0.55 0.18 145 / 0.5)" }} title="Working" />
                      ) : (
                        <span className="inline-block w-6 h-6 rounded-full" style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}` }} title="Day off" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs" style={{ color: theme.textFaint }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-full" style={{ background: "oklch(0.55 0.18 145 / 0.25)", border: "1px solid oklch(0.55 0.18 145 / 0.5)" }} />
          Working
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-full" style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}` }} />
          Day off
        </div>
      </div>
    </div>
  );
}

// ─── Cycle Tracker Tab ────────────────────────────────────────────────────
function CycleTrackerTab({ theme }: { theme: Theme }) {
  // Load list of all available cycles for this agent
  const { data: availableCycles = [], isLoading: loadingCycles } = trpc.cycleTracker.getMyTrackerHistory.useQuery();
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  // Default to current cycle key
  const currentCycleKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();
  const activeCycle = selectedCycle ?? (availableCycles.includes(currentCycleKey) ? currentCycleKey : availableCycles[0] ?? currentCycleKey);
  const cycleIndex = availableCycles.indexOf(activeCycle);
  const prevCycle = cycleIndex < availableCycles.length - 1 ? availableCycles[cycleIndex + 1] : null; // older
  const nextCycle = cycleIndex > 0 ? availableCycles[cycleIndex - 1] : null; // newer
  const isCurrentCycle = activeCycle === currentCycleKey;

  const { data, isLoading } = trpc.cycleTracker.getMyTrackerByCycle.useQuery(
    { cycleKey: activeCycle },
    { enabled: !!activeCycle, refetchInterval: isCurrentCycle ? 2 * 60 * 60 * 1000 : false, staleTime: isCurrentCycle ? 30 * 60 * 1000 : Infinity }
  );

  function formatCycleLabel(ck: string) {
    const [y, m] = ck.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  if (loadingCycles || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Activity className="w-10 h-10" style={{ color: theme.textFaint }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>No cycle data available yet.</p>
        <p className="text-xs text-center max-w-xs" style={{ color: theme.textFaint }}>Your CRDTS hasn't been linked to any cycle data. Ask your admin to upload the stats Excel.</p>
      </div>
    );
  }

  const { stats, todayStats, deductions, ot, cycleKey, dateRange } = data;

  // Today section
  const todayLoginHours = todayStats?.reduce((s, r) => s + parseFloat(String(r.loginHours ?? 0)), 0) ?? 0;
  const todayCalls = todayStats?.reduce((s, r) => s + (r.totalCalls ?? 0), 0) ?? 0;
  const todayRevenue = todayStats?.reduce((s, r) => s + parseFloat(String(r.revenue ?? 0)), 0) ?? 0;

  // Cycle totals
  const cycleLoginHours = stats.reduce((s, r) => s + parseFloat(String(r.loginHours ?? 0)), 0);
  const cycleCalls = stats.reduce((s, r) => s + (r.totalCalls ?? 0), 0);
  const cycleRevenue = stats.reduce((s, r) => s + parseFloat(String(r.revenue ?? 0)), 0);
  const cycleCost = stats.reduce((s, r) => s + parseFloat(String(r.cost ?? 0)), 0);
  const cycleProfit = stats.reduce((s, r) => s + parseFloat(String(r.profit ?? 0)), 0);
  const revenuePerHour = cycleLoginHours > 0 ? cycleRevenue / cycleLoginHours : 0;

  // Deductions total
  const totalDeductions = deductions.reduce((s, r) => s + parseFloat(String(r.deductionAmount ?? 0)), 0);

  // OT totals
  const totalOTHours = ot.reduce((s, r) => s + parseFloat(String(r.hours ?? 0)), 0);
  const totalOTEgp = ot.reduce((s, r) => s + parseFloat(String(r.egpAmount ?? 0)), 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "oklch(0.65 0.18 85 / 0.12)", border: "1px solid oklch(0.65 0.18 85 / 0.3)" }}>
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "oklch(0.65 0.18 85)" }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "oklch(0.65 0.18 85)" }}>Indicative Data Only</p>
          <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>Data shown is indicative and subject to change. Final payslip available on the 25th. Cycle: {dateRange.start} → {dateRange.end}</p>
        </div>
      </div>

      {/* Cycle Selector */}
      {availableCycles.length > 0 && (
        <div className="flex items-center gap-3">
          <button disabled={!prevCycle} onClick={() => setSelectedCycle(prevCycle!)}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 text-lg"
            style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8249;</button>
          <span className="text-base font-semibold min-w-[180px] text-center" style={{ color: theme.text }}>
            {formatCycleLabel(activeCycle)}
            {isCurrentCycle && <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: `${BRAND}22`, color: BRAND }}>Current</span>}
          </span>
          <button disabled={!nextCycle} onClick={() => setSelectedCycle(nextCycle!)}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 text-lg"
            style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, color: theme.text }}>&#8250;</button>
        </div>
      )}

      {/* Section 1 — Today */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: BRAND }} />
          <h3 className="font-semibold text-sm" style={{ color: theme.text }}>Today — {today}</h3>
          {todayStats && todayStats.length === 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme.inputBg, color: theme.textFaint }}>No data yet</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Login Hours", value: todayLoginHours.toFixed(1) + "h", icon: <Clock className="w-4 h-4" /> },
            { label: "Total Calls", value: todayCalls.toLocaleString(), icon: <BarChart2 className="w-4 h-4" /> },
            { label: "Revenue", value: `$${todayRevenue.toLocaleString()}`, icon: <TrendingUp className="w-4 h-4" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: theme.inputBg }}>
              <div className="flex justify-center mb-1" style={{ color: theme.textFaint }}>{icon}</div>
              <div className="text-lg font-bold" style={{ color: theme.text }}>{value}</div>
              <div className="text-xs" style={{ color: theme.textFaint }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — This Cycle Performance */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: BRAND }} />
          <h3 className="font-semibold text-sm" style={{ color: theme.text }}>This Cycle Performance</h3>
          <span className="text-xs" style={{ color: theme.textFaint }}>{stats.length} days recorded</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Login Hours", value: cycleLoginHours.toFixed(1) + "h" },
            { label: "Total Calls", value: cycleCalls.toLocaleString() },
            { label: "Total Revenue", value: `$${cycleRevenue.toLocaleString()}` },
            { label: "Total Cost", value: `$${cycleCost.toLocaleString()}` },
            { label: "Total Profit", value: `$${cycleProfit.toLocaleString()}` },
            { label: "Revenue / Hour", value: `$${revenuePerHour.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: theme.inputBg }}>
              <div className="text-base font-bold" style={{ color: theme.text }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textFaint }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3 — Deductions */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4" style={{ color: "oklch(0.55 0.22 25)" }} />
            <h3 className="font-semibold text-sm" style={{ color: theme.text }}>Deductions This Cycle</h3>
          </div>
          {totalDeductions > 0 && (
            <span className="text-sm font-bold" style={{ color: "oklch(0.55 0.22 25)" }}>-EGP {totalDeductions.toLocaleString()}</span>
          )}
        </div>
        {deductions.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: theme.textFaint }}>No approved deductions this cycle.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                  {["Date", "Violation", "Hours", "Amount"].map(h => (
                    <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: theme.textFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deductions.map((d, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                    <td className="py-2 px-2" style={{ color: theme.textMuted }}>{d.date}</td>
                    <td className="py-2 px-2" style={{ color: theme.text }}>{d.violationType}</td>
                    <td className="py-2 px-2" style={{ color: theme.textMuted }}>{parseFloat(String(d.hours ?? 0)).toFixed(1)}h</td>
                    <td className="py-2 px-2 font-medium" style={{ color: "oklch(0.55 0.22 25)" }}>-EGP {parseFloat(String(d.deductionAmount ?? 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4 — OT */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: "oklch(0.55 0.18 145)" }} />
            <h3 className="font-semibold text-sm" style={{ color: theme.text }}>OT This Cycle</h3>
          </div>
          {totalOTHours > 0 && (
            <span className="text-sm font-bold" style={{ color: "oklch(0.55 0.18 145)" }}>+{totalOTHours.toFixed(1)}h · EGP {totalOTEgp.toLocaleString()}</span>
          )}
        </div>
        {ot.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: theme.textFaint }}>No OT recorded this cycle.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                  {["Date", "OT Type", "Hours", "Amount"].map(h => (
                    <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: theme.textFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ot.map((o, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                    <td className="py-2 px-2" style={{ color: theme.textMuted }}>{o.date}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.55 0.18 145 / 0.15)", color: "oklch(0.55 0.18 145)" }}>{o.otType}</span>
                    </td>
                    <td className="py-2 px-2" style={{ color: theme.textMuted }}>{parseFloat(String(o.hours ?? 0)).toFixed(1)}h</td>
                    <td className="py-2 px-2 font-medium" style={{ color: "oklch(0.55 0.18 145)" }}>+EGP {parseFloat(String(o.egpAmount ?? 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
