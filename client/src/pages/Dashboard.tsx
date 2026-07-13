import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { STAGE_LABELS, STAGE_DOT, STAGE_BADGE, type PipelineStage, ACTIVE_STAGES } from "@/lib/pipeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, UserCheck, CalendarClock, TrendingUp,
  MessageCircle, Mic, Video, Send, UserX, Timer, ArrowRight,
  Briefcase, Activity, Inbox, CalendarDays, Building2, Wallet, CheckCircle2, ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessPath } from "@/lib/roleTabs";

type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

const FUNNEL_COLORS: Record<string, string> = {
  applied: "#64748b",
  whatsapp_sent: "#22c55e",
  voice_note_reviewed: "#3b82f6",
  interview_scheduled: "#7c3aed",
  accepted: "#10b981",
  no_answer: "#f97316",
  whatsapp_group_added: "#0d9488",
  rejected: "#ef4444",
  blacklisted: "#374151",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const [period, setPeriod] = useState<Period>("month");
  const periodInput = useMemo(() => ({ period }), [period]);

  const { data: kpis, isLoading } = trpc.dashboard.kpis.useQuery(periodInput);
  const { data: overview } = trpc.dashboard.overview.useQuery();
  const { data: candidates, isLoading: candidatesLoading } = trpc.candidates.list.useQuery();

  // ── Attention feeds (all existing endpoints) ──
  const { data: unreadRequests = 0 } = trpc.requests.countUnread.useQuery(undefined, { refetchInterval: 60000 });
  const { data: pendingLeave = [] } = trpc.leave.listRequests.useQuery({ status: "pending" }, { refetchInterval: 120000 });
  const { data: bdDue = [] } = trpc.bd.dueReminders.useQuery(undefined, { refetchInterval: 120000 });
  const { data: bdDeals = [] } = trpc.bd.listDeals.useQuery({});

  const pendingDeletion = overview?.pendingDeletionCount ?? 0;

  const openDeals = (bdDeals as Array<{ stage: string }>).filter(d => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const wonDeals = (bdDeals as Array<{ stage: string }>).filter(d => d.stage === "closed_won");

  // Only show cards for pages this role can actually open.
  const attention = [
    { count: Number(unreadRequests), label: "Requests to review", sub: "Agent requests waiting", icon: Inbox, tint: "amber", path: "/requests" },
    { count: (pendingLeave as unknown[]).length, label: "Leave approvals", sub: "Awaiting HR classification", icon: CalendarDays, tint: "violet", path: "/leave-management" },
    { count: (bdDue as unknown[]).length, label: "BD follow-ups due", sub: "Deals to chase today", icon: Building2, tint: "blue", path: "/business-development" },
    { count: pendingDeletion, label: "Former agents pending payout", sub: "Still owed final pay", icon: Wallet, tint: "red", path: "/operations" },
  ].filter(a => a.count > 0 && canAccessPath(role, a.path));

  const funnelData = kpis
    ? ACTIVE_STAGES.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        count: kpis.stageCounts[stage] ?? 0,
      }))
    : [];

  const turnoverColor =
    (kpis?.turnoverRate ?? 0) === 0 ? "text-emerald-600" :
    (kpis?.turnoverRate ?? 0) <= 5 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your command center — what needs attention & how the floor is doing.</p>
        </div>
      </div>

      {/* ═══ NEEDS YOUR ATTENTION ═══ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Needs your attention
        </h2>
        {attention.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">You're all caught up — nothing needs action right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {attention.map((a) => (
              <AttentionCard key={a.label} {...a} onClick={() => navigate(a.path)} />
            ))}
          </div>
        )}
      </section>

      {/* ═══ BUSINESS AT A GLANCE ═══ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Business at a glance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GlanceCard
            title="Active workforce"
            value={kpis?.turnoverHeadcount}
            icon={<Briefcase className="h-4 w-4" />}
            color="text-emerald-700" bgColor="bg-emerald-100"
            isLoading={isLoading}
            onClick={() => navigate("/operations")}
          />
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Monthly turnover</p>
              <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><Activity className="h-4 w-4" /></div>
            </div>
            {isLoading ? <Skeleton className="h-9 w-16" /> : <p className={`text-3xl font-bold ${turnoverColor}`}>{kpis?.turnoverRate ?? 0}%</p>}
            <p className="text-xs text-muted-foreground mt-1">{kpis?.turnoverSeparations ?? 0} left ÷ {kpis?.turnoverHeadcount ?? 0} agents</p>
          </div>
          <GlanceCard
            title="Open BD deals"
            value={openDeals.length}
            icon={<Building2 className="h-4 w-4" />}
            color="text-blue-700" bgColor="bg-blue-100"
            isLoading={false}
            sub={`${wonDeals.length} won`}
            onClick={() => navigate("/business-development")}
          />
          <GlanceCard
            title="New candidates"
            value={kpis?.newCandidates}
            icon={<UserCheck className="h-4 w-4" />}
            color="text-indigo-700" bgColor="bg-indigo-100"
            isLoading={isLoading}
            sub={PERIOD_LABELS[period]}
            onClick={() => navigate("/candidates")}
          />
        </div>
      </section>

      {/* ═══ RECRUITMENT ═══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recruitment pipeline</h2>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["week", "month", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Recruitment KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total in Pipeline" value={kpis?.totalInPipeline} icon={<Users className="h-4 w-4" />} isLoading={isLoading} color="text-slate-600" bgColor="bg-slate-100" />
          <KPICard title="WhatsApp Group Added" value={kpis?.whatsappGroupAdded} icon={<Send className="h-4 w-4" />} isLoading={isLoading} color="text-teal-600" bgColor="bg-teal-100" />
          <KPICard title="Interviews Scheduled" value={kpis?.scheduledInterviews} icon={<CalendarClock className="h-4 w-4" />} isLoading={isLoading} color="text-violet-600" bgColor="bg-violet-100" />
          <KPICard title="Avg. Time to Hire" value={kpis?.avgTimeToHireDays != null ? `${kpis.avgTimeToHireDays}d` : "—"} icon={<Timer className="h-4 w-4" />} isLoading={isLoading} color="text-amber-600" bgColor="bg-amber-100" />
        </div>

        {/* Rate cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RateCard title="Pipeline Conversion" value={kpis?.conversionRate} icon={<TrendingUp className="h-4 w-4" />} isLoading={isLoading} description="Applied → Accepted" color="text-emerald-600" bgColor="bg-emerald-100" />
          <RateCard title="WhatsApp Response" value={kpis?.whatsappResponseRate} icon={<MessageCircle className="h-4 w-4" />} isLoading={isLoading} description="Replied to intro" color="text-green-600" bgColor="bg-green-100" />
          <RateCard title="Voice Note Pass" value={kpis?.voiceNotePassRate} icon={<Mic className="h-4 w-4" />} isLoading={isLoading} description="Passed screening" color="text-blue-600" bgColor="bg-blue-100" />
          <RateCard title="Interview Show" value={kpis?.interviewShowRate} icon={<Video className="h-4 w-4" />} isLoading={isLoading} description="Attended Meet" color="text-violet-600" bgColor="bg-violet-100" />
        </div>

        {/* Funnel + side stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline Funnel — Stage Drop-off</h3>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-8 rounded" />)}</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => [value, "Candidates"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {funnelData.map((entry) => (
                      <Cell key={entry.stage} fill={FUNNEL_COLORS[entry.stage] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center"><UserX className="h-3.5 w-3.5 text-red-600" /></div>
                <h3 className="text-sm font-semibold text-foreground">Rejected</h3>
              </div>
              {isLoading ? <Skeleton className="h-10 w-16" /> : <p className="text-3xl font-bold text-red-600">{kpis?.stageCounts.rejected ?? 0}</p>}
              <p className="text-xs text-muted-foreground mt-1">Total rejected candidates</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Stage Breakdown</h3>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-5 rounded" />)}</div>
              ) : (
                <div className="space-y-2">
                  {ACTIVE_STAGES.map((stage) => {
                    const count = kpis?.stageCounts[stage] ?? 0;
                    const total = kpis?.totalInPipeline ?? 1;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={stage} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: FUNNEL_COLORS[stage] }} />
                        <span className="text-xs text-muted-foreground flex-1 truncate">{STAGE_LABELS[stage]}</span>
                        <span className="text-xs font-medium text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Candidates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Recent Candidates</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="text-xs gap-1 h-8">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        {candidatesLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : candidates && candidates.length > 0 ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Added</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 8).map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                    onClick={() => navigate(`/candidates/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STAGE_BADGE[c.status as PipelineStage]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[c.status as PipelineStage]}`} />
                        {STAGE_LABELS[c.status as PipelineStage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-xl">
            <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No candidates yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first candidate to get started.</p>
            <Button size="sm" onClick={() => navigate("/candidates")}>Add Candidate</Button>
          </div>
        )}
      </div>
    </div>
  );
}

const TINTS: Record<string, { bg: string; border: string; icon: string; text: string; count: string }> = {
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-900",   icon: "bg-amber-100 text-amber-600",   text: "text-amber-800 dark:text-amber-300",   count: "text-amber-700 dark:text-amber-300" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-900", icon: "bg-violet-100 text-violet-600", text: "text-violet-800 dark:text-violet-300", count: "text-violet-700 dark:text-violet-300" },
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-900",     icon: "bg-blue-100 text-blue-600",     text: "text-blue-800 dark:text-blue-300",     count: "text-blue-700 dark:text-blue-300" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-900",       icon: "bg-red-100 text-red-600",       text: "text-red-800 dark:text-red-300",       count: "text-red-700 dark:text-red-300" },
};

function AttentionCard({ count, label, sub, icon: Icon, tint, onClick }: {
  count: number; label: string; sub: string; icon: React.ElementType; tint: string; onClick: () => void;
}) {
  const t = TINTS[tint] ?? TINTS.amber;
  return (
    <button onClick={onClick} className={`text-left rounded-xl border ${t.border} ${t.bg} p-4 hover:shadow-sm transition-all group`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`h-8 w-8 rounded-lg ${t.icon} flex items-center justify-center`}><Icon className="h-4 w-4" /></div>
        <span className={`text-2xl font-bold ${t.count}`}>{count}</span>
      </div>
      <p className={`text-sm font-semibold ${t.text} flex items-center gap-1`}>{label} <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </button>
  );
}

function GlanceCard({ title, value, icon, isLoading, color, bgColor, sub, onClick }: {
  title: string; value: number | string | undefined; icon: React.ReactNode;
  isLoading: boolean; color: string; bgColor: string; sub?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick} className="text-left bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-all disabled:cursor-default">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={`h-7 w-7 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      {isLoading ? <Skeleton className="h-9 w-16" /> : <p className={`text-3xl font-bold ${color}`}>{value ?? 0}</p>}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}

function KPICard({ title, value, icon, isLoading, color, bgColor }: {
  title: string; value: number | string | undefined; icon: React.ReactNode;
  isLoading: boolean; color: string; bgColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={`h-7 w-7 rounded-lg ${bgColor} flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      {isLoading ? <Skeleton className="h-9 w-16" /> : <p className={`text-3xl font-bold ${color}`}>{value ?? 0}</p>}
    </div>
  );
}

function RateCard({ title, value, icon, isLoading, description, color, bgColor }: {
  title: string; value: number | undefined; icon: React.ReactNode;
  isLoading: boolean; description: string; color: string; bgColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className={`h-6 w-6 rounded-md ${bgColor} flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      {isLoading ? <Skeleton className="h-8 w-14" /> : <p className={`text-2xl font-bold ${color}`}>{value ?? 0}%</p>}
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bgColor.replace("-100", "-400")}`} style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
      </div>
    </div>
  );
}
