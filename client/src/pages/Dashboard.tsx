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
} from "lucide-react";
import { useLocation } from "wouter";

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
  teams_invitation_sent: "#4f46e5",
  rejected: "#ef4444",
  blacklisted: "#374151",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const periodInput = useMemo(() => ({ period }), [period]);

  const { data: kpis, isLoading } = trpc.dashboard.kpis.useQuery(periodInput);
  const { data: candidates, isLoading: candidatesLoading } = trpc.candidates.list.useQuery();

  const funnelData = kpis
    ? ACTIVE_STAGES.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage],
        count: kpis.stageCounts[stage] ?? 0,
      }))
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Call Center Agent recruitment · <span className="font-medium text-foreground">{PERIOD_LABELS[period]}</span>
          </p>
        </div>
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

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total in Pipeline" value={kpis?.totalInPipeline} icon={<Users className="h-4 w-4" />} isLoading={isLoading} color="text-slate-600" bgColor="bg-slate-100" />
        <KPICard title="New Candidates" value={kpis?.newCandidates} icon={<UserCheck className="h-4 w-4" />} isLoading={isLoading} color="text-blue-600" bgColor="bg-blue-100" />
        <KPICard title="Teams Invitations Sent" value={kpis?.teamsInvitationsSent} icon={<Send className="h-4 w-4" />} isLoading={isLoading} color="text-indigo-600" bgColor="bg-indigo-100" />
        <KPICard
          title="Avg. Time to Hire"
          value={kpis?.avgTimeToHireDays != null ? `${kpis.avgTimeToHireDays}d` : "—"}
          icon={<Timer className="h-4 w-4" />}
          isLoading={isLoading}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RateCard title="Pipeline Conversion" value={kpis?.conversionRate} icon={<TrendingUp className="h-4 w-4" />} isLoading={isLoading} description="Applied → Accepted" color="text-emerald-600" bgColor="bg-emerald-100" />
        <RateCard title="WhatsApp Response" value={kpis?.whatsappResponseRate} icon={<MessageCircle className="h-4 w-4" />} isLoading={isLoading} description="Replied to intro message" color="text-green-600" bgColor="bg-green-100" />
        <RateCard title="Voice Note Pass Rate" value={kpis?.voiceNotePassRate} icon={<Mic className="h-4 w-4" />} isLoading={isLoading} description="Passed initial screening" color="text-blue-600" bgColor="bg-blue-100" />
        <RateCard title="Interview Show Rate" value={kpis?.interviewShowRate} icon={<Video className="h-4 w-4" />} isLoading={isLoading} description="Attended Google Meet" color="text-violet-600" bgColor="bg-violet-100" />
      </div>

      {/* Funnel + Side Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Pipeline Funnel — Stage Drop-off</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-8 rounded" />)}</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [value, "Candidates"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {funnelData.map((entry) => (
                    <Cell key={entry.stage} fill={FUNNEL_COLORS[entry.stage] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Side stats */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center">
                <UserX className="h-3.5 w-3.5 text-red-600" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Rejected</h2>
            </div>
            {isLoading ? <Skeleton className="h-10 w-16" /> : (
              <p className="text-3xl font-bold text-red-600">{kpis?.stageCounts.rejected ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total rejected candidates</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <CalendarClock className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Interviews Scheduled</h2>
            </div>
            {isLoading ? <Skeleton className="h-10 w-16" /> : (
              <p className="text-3xl font-bold text-violet-600">{kpis?.scheduledInterviews ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{PERIOD_LABELS[period]}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Stage Breakdown</h2>
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
      {isLoading ? <Skeleton className="h-9 w-16" /> : (
        <p className={`text-3xl font-bold ${color}`}>{value ?? 0}</p>
      )}
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
      {isLoading ? <Skeleton className="h-8 w-14" /> : (
        <p className={`text-2xl font-bold ${color}`}>{value ?? 0}%</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${bgColor.replace("-100", "-400")}`}
          style={{ width: `${Math.min(value ?? 0, 100)}%` }}
        />
      </div>
    </div>
  );
}
