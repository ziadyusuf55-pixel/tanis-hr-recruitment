import { trpc } from "@/lib/trpc";
import { STAGE_LABELS, STAGE_DOT, PipelineStage } from "@/lib/pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, ArrowRight, Calendar, UserCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

type Period = "week" | "month" | "all";

const STAGE_ORDER: PipelineStage[] = ["applied", "shortlisted", "interviewed", "offered", "hired", "rejected"];

const PERIOD_LABELS: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<Period>("month");

  const periodInput = useMemo(() => ({ period }), [period]);

  const { data: pipeline, isLoading: pipelineLoading } = trpc.dashboard.pipelineCounts.useQuery(periodInput);
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(periodInput);
  const { data: candidates, isLoading: candidatesLoading } = trpc.candidates.list.useQuery();

  const totalInPeriod = pipeline?.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div className="space-y-7 max-w-6xl">
      {/* Page header with period selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Call Center Agent recruitment pipeline — <span className="font-medium text-foreground">{PERIOD_LABELS[period]}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(["week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={period === "all" ? "Total Candidates" : `New Candidates`}
          value={statsLoading ? null : (stats?.newCandidates ?? 0)}
          icon={<Users className="h-4 w-4" />}
          color="blue"
          onClick={() => navigate("/candidates")}
          sublabel={period !== "all" ? PERIOD_LABELS[period] : undefined}
        />
        <StatCard
          label="Hired"
          value={statsLoading ? null : (stats?.hiredCount ?? 0)}
          icon={<UserCheck className="h-4 w-4" />}
          color="green"
          sublabel={period !== "all" ? PERIOD_LABELS[period] : undefined}
        />
        <StatCard
          label="Interviews Scheduled"
          value={statsLoading ? null : (stats?.scheduledInterviews ?? 0)}
          icon={<Calendar className="h-4 w-4" />}
          color="violet"
          sublabel={period !== "all" ? PERIOD_LABELS[period] : undefined}
        />
        <StatCard
          label="Conversion Rate"
          value={statsLoading ? null : `${stats?.conversionRate ?? 0}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="orange"
          sublabel="Applied → Hired"
        />
      </div>

      {/* Pipeline overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pipeline Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalInPeriod} candidate{totalInPeriod !== 1 ? "s" : ""} · {PERIOD_LABELS[period]}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="text-xs gap-1 h-8">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {pipelineLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGE_ORDER.map((s) => (
              <Skeleton key={s} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGE_ORDER.map((stage) => {
              const count = pipeline?.find((p) => p.stage === stage)?.count ?? 0;
              return (
                <PipelineCard
                  key={stage}
                  stage={stage}
                  count={count}
                  total={totalInPeriod}
                  onClick={() => navigate("/candidates")}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Recent candidates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Recent Candidates</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/candidates")} className="text-xs gap-1 h-8">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {candidatesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
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
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageBadgeClass(c.status as PipelineStage)}`}>
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

function StatCard({
  label,
  value,
  icon,
  color,
  sublabel,
  onClick,
}: {
  label: string;
  value: string | number | null;
  icon: React.ReactNode;
  color: "blue" | "green" | "violet" | "orange";
  sublabel?: string;
  onClick?: () => void;
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <Card
      className={`border-border shadow-none ${onClick ? "cursor-pointer card-hover" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            {icon}
          </div>
        </div>
        {value === null ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        )}
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function PipelineCard({
  stage,
  count,
  total,
  onClick,
}: {
  stage: PipelineStage;
  count: number;
  total: number;
  onClick: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 cursor-pointer card-hover"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
        <span className="text-xs font-medium text-muted-foreground leading-tight">{STAGE_LABELS[stage]}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{count}</p>
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${STAGE_DOT[stage]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{pct}% of total</p>
    </div>
  );
}

function getStageBadgeClass(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    applied: "bg-blue-50 text-blue-700",
    shortlisted: "bg-sky-50 text-sky-700",
    interviewed: "bg-violet-50 text-violet-700",
    offered: "bg-orange-50 text-orange-700",
    hired: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-600",
  };
  return map[stage];
}
