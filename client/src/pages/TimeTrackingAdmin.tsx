import { useState } from "react";
import { etDateKey, etMonthKey, etToInput, etFromInput, fmtEtTime, fmtEtDateTime, fmtEtDate, fmtEtFull, TT_TZ_LABEL } from "@/lib/tz";
import { trpc } from "@/lib/trpc";
import { AUX_TYPE_OPTIONS } from "@shared/const";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, CalendarOff, AlertTriangle, CheckCircle2, Activity, BarChart2, Download, Trash2, LogOut, Users, Coffee, UtensilsCrossed, Timer } from "lucide-react";

type PtoReq = {
  id: number;
  traineeCode: string;
  agentName: string | null;
  requestType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
};

type ExceptionRow = {
  id: number;
  traineeCode: string;
  agentName: string | null;
  date: string;
  exceptionType: string;
  scheduledTime: string | null;
  actualTime: string | null;
  minutesLate: number | null;
  note: string | null;
  status?: "pending" | "reviewed";
  reviewedBy?: string | null;
};

type AuxLogRow = {
  id: number;
  traineeCode: string;
  auxType: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  note: string | null;
  fullName?: string | null;
  jobTitle?: string | null;
  clientName?: string | null;
};
// All shift/AUX times are shown and edited in US Eastern time (Quantum works US hours).
const toLocalInput = etToInput;

type HoursSummaryRow = {
  traineeCode: string;
  name: string;
  scheduledHrs: number;
  workedHrs: number;
  shiftHrs: number;
  auxMinutes: Record<string, number>;
  clientName: string | null;
  role: string | null;
  startDate: string | null;
  ptoHrs: number;
  unplannedHrs: number;
  lateEarly: number;
  status: string;
  agentStatus: string | null;
};
const fmtUS = (iso: string | null) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${Number(m)}/${Number(d)}/${y}`; };

// ── AUX type color palette ──────────────────────────────────────────────────
const AUX_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  break:      { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-300" },
  lunch:      { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-300" },
  bathroom:   { bg: "bg-sky-50",     text: "text-sky-700",    border: "border-sky-300" },
  training:   { bg: "bg-violet-50",  text: "text-violet-700", border: "border-violet-300" },
  meeting:    { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-300" },
  coaching:   { bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-300" },
  it_issue:   { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-300" },
};
const auxColor = (type: string) => AUX_COLORS[type] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-300" };

function AuxBadge({ type }: { type: string }) {
  const c = auxColor(type);
  const label = AUX_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border} capitalize`}>
      {type === "lunch" ? <UtensilsCrossed className="w-3 h-3" /> : type === "break" ? <Coffee className="w-3 h-3" /> : null}
      {label}
    </span>
  );
}

/** Hours → "H:MM" (7.53 → "7:32"). Every hour value on this page uses this format. */
function hhmm(hours: number | null | undefined): string {
  const totalMin = Math.max(0, Math.round((hours ?? 0) * 60));
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}`;
}
const minToHhmm = (min: number) => hhmm(min / 60);

/** Small two-line column header: name + what it means. */
function ColHead({ title, hint, className }: { title: React.ReactNode; hint: string; className?: string }) {
  return (
    <TableHead className={className}>
      <div className="leading-tight">{title}</div>
      <div className="text-[10px] font-normal text-muted-foreground leading-tight">{hint}</div>
    </TableHead>
  );
}

export default function TimeTrackingAdmin() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState("pto");
  const [excMonth, setExcMonth] = useState(() => etMonthKey());
  const today = etDateKey();
  const [auxDate, setAuxDate] = useState(today);
  const [auxAgentFilter, setAuxAgentFilter] = useState("");

  const currentMonth = etMonthKey();
  const [hoursMonth, setHoursMonth] = useState(currentMonth);
  const [hoursGroupByRole, setHoursGroupByRole] = useState(true);

  // Compute from/to for the selected month
  const hoursFrom = hoursMonth + "-01";
  const hoursTo = (() => {
    const [y, m] = hoursMonth.split("-").map(Number);
    const last = new Date(y!, m!, 0).getDate(); // day 0 of next month = last of this
    return `${hoursMonth}-${String(last).padStart(2, "0")}`;
  })();

  const { data: ptoRequests = [] } = trpc.timeTracking.allPtoRequests.useQuery({ status: "decided" });
  const { data: exceptions = [] } = trpc.timeTracking.allExceptions.useQuery({ month: excMonth });
  const { data: auxLogs = [] } = trpc.timeTracking.auxLogs.useQuery({ date: auxDate || undefined });
  const [auxEdit, setAuxEdit] = useState<AuxLogRow | null>(null);
  const [auxEditForm, setAuxEditForm] = useState({ auxType: "break", start: "", end: "", note: "" });
  const updateAux = trpc.timeTracking.updateAux.useMutation({
    onSuccess: () => { utils.timeTracking.auxLogs.invalidate(); utils.timeTracking.workedSummary.invalidate(); setAuxEdit(null); toast.success("AUX entry updated"); },
    onError: (e) => toast.error(e.message),
  });
  const auxExport = trpc.timeTracking.auxLogs.useQuery({ from: hoursFrom, to: hoursTo }, { enabled: false });
  // Productivity for the selected AUX day: shift time − AUX time = productive time, per agent (Quantum only).
  const { data: dayProd = [], isFetching: dayProdLoading } = trpc.timeTracking.workedSummary.useQuery(
    { from: auxDate, to: auxDate },
    { enabled: tab === "aux" && /^\d{4}-\d{2}-\d{2}$/.test(auxDate), refetchInterval: 60000 }
  );
  const [prodShowAll, setProdShowAll] = useState(false);
  const { data: hoursSummary = [], isFetching: hoursLoading } = trpc.timeTracking.workedSummary.useQuery(
    { from: hoursFrom, to: hoursTo },
    { enabled: tab === "hours" }
  );

  const { data: openShifts = [] } = trpc.timeTracking.openShifts.useQuery(undefined, { refetchInterval: 60000, enabled: tab === "open" });
  const deleteAux = trpc.timeTracking.deleteAux.useMutation({
    onSuccess: () => { utils.timeTracking.auxLogs.invalidate(); utils.timeTracking.workedSummary.invalidate(); toast.success("AUX entry deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const adminClockOut = trpc.timeTracking.adminClockOut.useMutation({
    onSuccess: () => { utils.timeTracking.openShifts.invalidate(); utils.timeTracking.workedSummary.invalidate(); toast.success("Agent clocked out"); },
    onError: (e) => toast.error(e.message),
  });
  const reviewException = trpc.timeTracking.reviewException.useMutation({
    onSuccess: () => { utils.timeTracking.allExceptions.invalidate(); toast.success("Marked as reviewed"); },
    onError: (e) => toast.error(e.message),
  });


  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Time Tracking
        </h1>
        <p className="text-sm text-muted-foreground">Review PTO requests, attendance exceptions, and AUX logs</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pto" className="gap-1.5">
            <CalendarOff className="w-3.5 h-3.5" /> PTO Log
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Attendance Exceptions
          </TabsTrigger>
          <TabsTrigger value="aux" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> AUX Logs
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Monthly Hours
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> On Shift Now
          </TabsTrigger>
        </TabsList>

        {/* ── ON SHIFT NOW ─────────────────────────────────────────────────── */}
        <TabsContent value="open" className="mt-4">
          {(() => {
            const shifts = openShifts as Array<{ id: number; traineeCode: string; fullName: string | null; jobTitle: string | null; clockIn: number; state: string; auxSince: number | null }>;
            const now = Date.now();

            // Summary stat cards
            const available = shifts.filter(s => s.state === "available").length;
            const onBreak   = shifts.filter(s => s.state === "break").length;
            const onLunch   = shifts.filter(s => s.state === "lunch").length;
            const onAux     = shifts.filter(s => s.state !== "available").length;

            return (
              <>
                {/* Stat pills row */}
                {shifts.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <span className="text-2xl font-bold text-foreground">{shifts.length}</span>
                      <span className="text-[11px] text-muted-foreground">agents on shift</span>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 flex flex-col gap-0.5">
                      <span className="text-xs text-emerald-600">Working</span>
                      <span className="text-2xl font-bold text-emerald-700">{available}</span>
                      <span className="text-[11px] text-emerald-500">available state</span>
                    </div>
                    <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 flex flex-col gap-0.5">
                      <span className="text-xs text-amber-600">On Break</span>
                      <span className="text-2xl font-bold text-amber-700">{onBreak}</span>
                      <span className="text-[11px] text-amber-500">break state</span>
                    </div>
                    <div className="rounded-lg border bg-sky-50 border-sky-200 p-3 flex flex-col gap-0.5">
                      <span className="text-xs text-sky-600">At Lunch / AUX</span>
                      <span className="text-2xl font-bold text-sky-700">{onLunch + onAux - onBreak}</span>
                      <span className="text-[11px] text-sky-500">lunch & other</span>
                    </div>
                  </div>
                )}

                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      Everyone currently clocked in. Shifts never end on their own — if someone forgot to clock out, end it here (any open AUX is ended too).
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Clocked in</TableHead>
                          <ColHead className="text-right" title="Shift so far" hint="clock-in → now (H:MM)" />
                          <TableHead>Current state</TableHead>
                          <ColHead className="text-right" title="In state" hint="time in current state" />
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nobody is clocked in.</TableCell></TableRow>
                        ) : shifts.map(sft => {
                          const totalHrs = (now - sft.clockIn) / 3600000;
                          const inStateMin = sft.auxSince ? Math.floor((now - sft.auxSince) / 60000) : null;
                          const stateKey = sft.state as string;
                          const sc = auxColor(stateKey);
                          return (
                            <TableRow key={sft.id} className={totalHrs > 14 ? "bg-amber-50/50" : undefined}>
                              <TableCell>
                                <div className="font-medium">{sft.fullName || sft.traineeCode}</div>
                                <div className="text-xs font-mono text-muted-foreground">{sft.traineeCode}</div>
                              </TableCell>
                              <TableCell className="text-sm">{sft.jobTitle ?? "—"}</TableCell>
                              <TableCell className="text-sm font-mono">{fmtEtDateTime(sft.clockIn)} {TT_TZ_LABEL}</TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums">
                                {hhmm(totalHrs)}
                                {totalHrs > 14 && <span className="ml-1 text-xs text-amber-600 font-normal">· likely forgot</span>}
                              </TableCell>
                              <TableCell>
                                {sft.state === "available" ? (
                                  <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700">Working</Badge>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border} capitalize`}>
                                    {sft.state === "lunch" ? <UtensilsCrossed className="w-3 h-3" /> : sft.state === "break" ? <Coffee className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                                    {sft.state.replace(/_/g, " ")}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {inStateMin != null ? minToHhmm(inStateMin) : "—"}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" className="gap-1" disabled={adminClockOut.isPending}
                                  onClick={() => {
                                    const def = new Date(Math.min(Date.now(), sft.clockIn + 9 * 3600000));
                                    const ans = prompt(`Clock out ${sft.fullName || sft.traineeCode} at what time?\n(YYYY-MM-DD HH:MM, 24h, US Eastern time — leave as is to accept)`, toLocalInput(def.getTime()).replace("T", " "));
                                    if (ans == null) return;
                                    const at = etFromInput(ans);
                                    if (!Number.isFinite(at)) { toast.error("Could not read that time"); return; }
                                    if (at < sft.clockIn) { toast.error("Clock-out is before clock-in"); return; }
                                    if (at > Date.now()) { toast.error("Clock-out is in the future"); return; }
                                    adminClockOut.mutate({ shiftId: sft.id, at });
                                  }}>
                                  <LogOut className="w-3.5 h-3.5" /> Clock out
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── PTO LOG ──────────────────────────────────────────────────────── */}
        <TabsContent value="pto" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">Decided leave for time-tracking clients. Agents submit leave in their portal's Request Center and it is approved or rejected in <strong>Requests</strong>; the outcome is logged here.</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Decided by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ptoRequests as PtoReq[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No PTO requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (ptoRequests as PtoReq[]).map(req => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-medium">{req.agentName || req.traineeCode}</div>
                          <div className="text-xs text-muted-foreground font-mono">{req.traineeCode}</div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {req.requestType}
                        </TableCell>
                        <TableCell className="text-sm">{req.startDate} → {req.endDate}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                          {req.reason ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                            className="capitalize text-xs"
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{(req as PtoReq & { reviewedBy?: string | null; leaveType?: string | null }).reviewedBy ?? "—"}{(req as PtoReq & { leaveType?: string | null }).leaveType ? ` · ${(req as PtoReq & { leaveType?: string | null }).leaveType}` : ""}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ATTENDANCE EXCEPTIONS ─────────────────────────────────────────── */}
        <TabsContent value="exceptions" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium">Month:</label>
            <input
              type="month"
              value={excMonth}
              onChange={e => setExcMonth(e.target.value)}
              className="rounded-md border px-2.5 py-1.5 text-sm bg-background"
            />
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Minutes Late</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(exceptions as ExceptionRow[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No exceptions for {excMonth}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (exceptions as ExceptionRow[]).map(exc => (
                      <TableRow key={exc.id}>
                        <TableCell>
                          <div className="font-medium">{exc.agentName || exc.traineeCode}</div>
                          <div className="text-xs font-mono text-muted-foreground">{exc.traineeCode}</div>
                        </TableCell>
                        <TableCell>{exc.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {exc.exceptionType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{exc.scheduledTime ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{exc.actualTime ?? "—"}</TableCell>
                        <TableCell>{exc.minutesLate != null ? `${exc.minutesLate}m` : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {exc.note ?? "—"}
                        </TableCell>
                        <TableCell>
                          {exc.status === "reviewed" ? (
                            <Badge variant="secondary" className="text-xs">Reviewed{exc.reviewedBy ? ` · ${exc.reviewedBy}` : ""}</Badge>
                          ) : (
                            <Button size="sm" variant="outline" disabled={reviewException.isPending} onClick={() => reviewException.mutate({ id: exc.id })}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark reviewed
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AUX LOGS ─────────────────────────────────────────────────────── */}
        <TabsContent value="aux" className="mt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Date:</label>
              <input
                type="date"
                value={auxDate}
                onChange={e => setAuxDate(e.target.value)}
                className="rounded-md border px-2.5 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Agent Code:</label>
              <input
                type="text"
                placeholder="e.g. T-12345"
                value={auxAgentFilter}
                onChange={e => setAuxAgentFilter(e.target.value)}
                className="rounded-md border px-2.5 py-1.5 text-sm bg-background w-36"
              />
            </div>
            {auxAgentFilter && (
              <Button size="sm" variant="ghost" onClick={() => setAuxAgentFilter("")} className="text-xs">
                Clear
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={async () => {
              const res = await auxExport.refetch();
              const rows = (res.data ?? []) as AuxLogRow[];
              if (!rows.length) { toast.message(`No AUX entries in ${hoursMonth}`); return; }
              const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
              const fmt = (ms: number | null) => ms == null ? "" : fmtEtFull(ms);
              const header = ["Employee", "Quantum Client", "Role", "Date", "AUX Type", "Start (ET)", "End (ET)", "Duration (min)", "Note"];
              const lines = [header.join(","), ...rows.map(r => [
                esc(r.fullName ?? r.traineeCode), esc(r.clientName ?? ""), esc(r.jobTitle ?? ""),
                fmtEtDate(r.startTime), esc(r.auxType.replace(/_/g, " ")), fmt(r.startTime), fmt(r.endTime),
                r.durationMs != null ? Math.round(r.durationMs / 60000) : "", esc(r.note ?? ""),
              ].join(","))];
              const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `aux_logs_${hoursMonth}.csv`; a.click(); URL.revokeObjectURL(url);
            }}>
              <Download className="w-3.5 h-3.5" /> Export month ({hoursMonth})
            </Button>
          </div>

          {/* Productivity card — lunch excluded from denominator */}
          {(() => {
            const rows = (dayProd as HoursSummaryRow[])
              .filter(r => prodShowAll || r.shiftHrs > 0 || Object.keys(r.auxMinutes ?? {}).length > 0)
              .filter(r => !auxAgentFilter || r.traineeCode.toLowerCase().includes(auxAgentFilter.toLowerCase()) || r.name.toLowerCase().includes(auxAgentFilter.toLowerCase()))
              .sort((a, b) => (a.role ?? "").localeCompare(b.role ?? "") || a.name.localeCompare(b.name));

            // Helpers to split break / lunch / other from auxMinutes
            const auxMin = (r: HoursSummaryRow, ...types: string[]) => {
              const am = r.auxMinutes ?? {};
              return types.length === 0
                ? Math.round(Object.values(am).reduce((x, y) => x + y, 0))
                : Math.round(types.reduce((s, t) => s + (am[t] ?? 0), 0));
            };
            const lunchHrs = (r: HoursSummaryRow) => (r.auxMinutes?.lunch ?? 0) / 60;
            const breakHrs = (r: HoursSummaryRow) => (r.auxMinutes?.break ?? 0) / 60;
            const otherAuxMin = (r: HoursSummaryRow) => auxMin(r) - auxMin(r, "lunch", "break");

            // Productivity: excludes lunch from denominator (lunch ≠ unproductive time)
            // worked = shift − all_aux; pct = worked / (shift − lunch) × 100
            const pct = (r: HoursSummaryRow) => {
              const denom = r.shiftHrs - lunchHrs(r);
              return denom > 0 ? Math.round((r.workedHrs / denom) * 100) : null;
            };

            const tot = rows.reduce((acc, r) => ({
              shift: acc.shift + r.shiftHrs,
              worked: acc.worked + r.workedHrs,
              breakMin: acc.breakMin + auxMin(r, "break"),
              lunchMin: acc.lunchMin + auxMin(r, "lunch"),
              otherMin: acc.otherMin + otherAuxMin(r),
            }), { shift: 0, worked: 0, breakMin: 0, lunchMin: 0, otherMin: 0 });

            const exportDay = () => {
              const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
              const header = ["Employee", "Quantum Client", "Role", "Date", "Shift (H:MM)", "Working (H:MM)", "Shift (decimal hrs)", "Working (decimal hrs)", "Break (min)", "Lunch (min)", "Other AUX (min)", "Productivity %"];
              const lines = [header.join(","), ...rows.map(r => [
                esc(r.name), esc(r.clientName ?? ""), esc(r.role ?? ""), auxDate,
                hhmm(r.shiftHrs), hhmm(r.workedHrs), r.shiftHrs.toFixed(2), r.workedHrs.toFixed(2),
                auxMin(r, "break"), auxMin(r, "lunch"), otherAuxMin(r), pct(r) ?? "",
              ].join(","))];
              const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `productivity_${auxDate}.csv`; a.click(); URL.revokeObjectURL(url);
            };

            return (
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold">Productivity — {auxDate}</h3>
                      <p className="text-xs text-muted-foreground">
                        All times are <span className="font-medium text-foreground">H:MM</span>.
                        <span className="font-medium text-foreground"> Shift</span> = total clocked time (clock-in → clock-out).
                        <span className="font-medium text-foreground"> Working</span> = shift − all AUX (break, lunch, bathroom, …).
                        Productivity % = working ÷ (shift − lunch) — <span className="font-medium text-foreground">lunch is not counted as lost time</span>.
                      </p>
                    </div>
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={prodShowAll} onChange={e => setProdShowAll(e.target.checked)} /> show agents with no activity
                    </label>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={rows.length === 0} onClick={exportDay}>
                      <Download className="w-3.5 h-3.5" /> Export day
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Role</TableHead>
                        <ColHead className="text-right" title="Shift" hint="clocked in → out" />
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1"><Coffee className="w-3 h-3 text-amber-500" /> Break</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="flex items-center justify-end gap-1"><UtensilsCrossed className="w-3 h-3 text-emerald-600" /> Lunch</span>
                        </TableHead>
                        <ColHead className="text-right" title="Working" hint="shift − all AUX" />
                        <TableHead className="text-right">Productivity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayProdLoading && rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>
                      ) : rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No shifts or AUX on {auxDate}.</TableCell></TableRow>
                      ) : (
                        <>
                          {rows.map(r => {
                            const p = pct(r);
                            return (
                              <TableRow key={r.traineeCode}>
                                <TableCell>
                                  <div className="font-medium text-sm">{r.name}</div>
                                  <div className="text-[11px] text-muted-foreground font-mono">{r.traineeCode}</div>
                                </TableCell>
                                <TableCell className="text-sm">{r.role ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">{hhmm(r.shiftHrs)}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  <span className="text-amber-700">{minToHhmm(auxMin(r, "break"))}</span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  <span className="text-emerald-700">{minToHhmm(auxMin(r, "lunch"))}</span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-semibold">{hhmm(r.workedHrs)}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {p == null
                                    ? <span className="text-muted-foreground">—</span>
                                    : <span className={p >= 85 ? "text-emerald-600 font-semibold" : p >= 70 ? "text-amber-600" : "text-red-600"}>{p}%</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/40 font-semibold">
                            <TableCell colSpan={2} className="text-sm">Total ({rows.length} agent{rows.length !== 1 ? "s" : ""})</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{hhmm(tot.shift)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-amber-700">{minToHhmm(tot.breakMin)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-emerald-700">{minToHhmm(tot.lunchMin)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{hhmm(tot.worked)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {tot.shift > 0
                                ? (() => { const d = tot.shift - tot.lunchMin / 60; return d > 0 ? Math.round((tot.worked / d) * 100) + "%" : "—"; })()
                                : "—"}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}

          {/* AUX log edit form */}
          {auxEdit && (
            <Card className="mb-4 border-primary/40">
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-xs font-medium block mb-1">Type</label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={auxEditForm.auxType} onChange={e => setAuxEditForm(f => ({ ...f, auxType: e.target.value }))}>
                    {AUX_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Start</label>
                  <input type="datetime-local" className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={auxEditForm.start} onChange={e => setAuxEditForm(f => ({ ...f, start: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">End {auxEdit.endTime == null && <span className="text-muted-foreground font-normal">(blank = still open)</span>}</label>
                  <input type="datetime-local" className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={auxEditForm.end} onChange={e => setAuxEditForm(f => ({ ...f, end: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Note</label>
                  <input className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={auxEditForm.note} onChange={e => setAuxEditForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={updateAux.isPending || (auxEdit.endTime != null && !auxEditForm.end)} title={auxEdit.endTime != null && !auxEditForm.end ? "A closed AUX needs an end time" : undefined} onClick={() => updateAux.mutate({
                    id: auxEdit.id,
                    auxType: auxEditForm.auxType as "break",
                    startTime: auxEditForm.start ? etFromInput(auxEditForm.start) : undefined,
                    endTime: auxEditForm.end ? etFromInput(auxEditForm.end) : null,
                    note: auxEditForm.note || null,
                  })}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAuxEdit(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AUX log table with stat summary and colored badges */}
          {(() => {
            const filtered = (auxLogs as AuxLogRow[]).filter(l =>
              !auxAgentFilter || l.traineeCode.toLowerCase().includes(auxAgentFilter.toLowerCase())
            );

            // Aggregate stats per AUX type for the day
            const typeTotals: Record<string, number> = {};
            for (const log of filtered) {
              const dur = log.durationMs ?? (log.endTime ? log.endTime - log.startTime : null);
              if (dur != null) typeTotals[log.auxType] = (typeTotals[log.auxType] ?? 0) + dur;
            }
            const activeCount = filtered.filter(l => l.endTime == null).length;

            return (
              <Card>
                <CardContent className="pt-4">
                  {/* Type summary chips */}
                  {Object.keys(typeTotals).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b">
                      {Object.entries(typeTotals).sort(([, a], [, b]) => b - a).map(([type, ms]) => {
                        const c = auxColor(type);
                        const label = AUX_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type.replace(/_/g, " ");
                        return (
                          <div key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${c.bg} ${c.border}`}>
                            <span className={`${c.text} capitalize`}>{label}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className={`${c.text} font-semibold tabular-nums`}>{Math.round(ms / 60000)}m</span>
                          </div>
                        );
                      })}
                      {activeCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium bg-amber-50 border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-amber-700">{activeCount} active</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>AUX Type</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No AUX logs{auxDate ? ` for ${auxDate}` : ""}{auxAgentFilter ? ` matching "${auxAgentFilter}"` : ""}.
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(log => {
                        const start = new Date(log.startTime);
                        const end = log.endTime ? new Date(log.endTime) : null;
                        const durMs = log.durationMs ?? (end ? log.endTime! - log.startTime : null);
                        const durStr = durMs != null
                          ? `${Math.floor(durMs / 60000)}m ${Math.floor((durMs % 60000) / 1000)}s`
                          : "—";
                        return (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{log.fullName ?? log.traineeCode}</div>
                              <div className="text-xs text-muted-foreground font-mono">{log.traineeCode}{log.jobTitle ? ` · ${log.jobTitle}` : ""}</div>
                            </TableCell>
                            <TableCell>
                              <AuxBadge type={log.auxType} />
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {fmtEtTime(start.getTime(), true)}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {end ? fmtEtTime(end.getTime(), true) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Active
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">{durStr}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {log.note ?? "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Adjust this AUX entry"
                                onClick={() => { setAuxEdit(log); setAuxEditForm({ auxType: log.auxType, start: toLocalInput(log.startTime), end: toLocalInput(log.endTime), note: log.note ?? "" }); }}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" title="Delete this AUX entry"
                                disabled={deleteAux.isPending}
                                onClick={() => { if (confirm(`Delete this ${log.auxType.replace(/_/g, " ")} entry for ${log.traineeCode}?`)) deleteAux.mutate({ id: log.id }); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ── MONTHLY HOURS ─────────────────────────────────────────────────── */}
        <TabsContent value="hours" className="mt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Month:</label>
              <input
                type="month"
                value={hoursMonth}
                onChange={e => setHoursMonth(e.target.value)}
                className="rounded-md border px-2.5 py-1.5 text-sm bg-background"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={hoursGroupByRole} onChange={e => setHoursGroupByRole(e.target.checked)} />
              Group by position
            </label>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 ml-auto"
              disabled={(hoursSummary as HoursSummaryRow[]).length === 0}
              onClick={() => {
                const rows = hoursSummary as HoursSummaryRow[];
                const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
                const header = ["Employee", "Quantum Client", "Role", "Start Date", "Scheduled (H:MM)", "Shift (H:MM)", "Worked (H:MM)", "PTO (H:MM)", "Unplanned (H:MM)", "Sched. Hrs (decimal)", "Shift Hrs (decimal)", "Worked Hrs (decimal)", "PTO Hrs (decimal)", "Unplanned Hrs (decimal)", "Late / Early", "Status"];
                const sorted = [...rows].sort((a, b) => (a.role ?? "zzz").localeCompare(b.role ?? "zzz") || a.name.localeCompare(b.name));
                const csvRows = [header.join(","), ...sorted.map(r => [
                  esc(r.name), esc(r.clientName ?? ""), esc(r.role ?? ""), esc(fmtUS(r.startDate)),
                  hhmm(r.scheduledHrs), hhmm(r.shiftHrs), hhmm(r.workedHrs), hhmm(r.ptoHrs), hhmm(r.unplannedHrs),
                  r.scheduledHrs, r.shiftHrs, r.workedHrs, r.ptoHrs, r.unplannedHrs, r.lateEarly, esc(r.status),
                ].join(","))];
                const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `roster_attendance_${hoursMonth}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3.5 h-3.5" /> Export roster CSV
            </Button>
          </div>

          {/* Monthly summary stat cards */}
          {!hoursLoading && (hoursSummary as HoursSummaryRow[]).length > 0 && (() => {
            const rows = hoursSummary as HoursSummaryRow[];
            const totalSched  = rows.reduce((s, r) => s + r.scheduledHrs, 0);
            const totalShift  = rows.reduce((s, r) => s + r.shiftHrs, 0);
            const totalWorked = rows.reduce((s, r) => s + r.workedHrs, 0);
            const totalPto    = rows.reduce((s, r) => s + r.ptoHrs, 0);
            const totalUnplan = rows.reduce((s, r) => s + r.unplannedHrs, 0);
            const utilPct     = totalSched > 0 ? Math.round((totalWorked / totalSched) * 100) : null;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1">Agents</div>
                  <div className="text-2xl font-bold">{rows.length}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{hoursMonth}</div>
                </div>
                <div className="rounded-lg border bg-blue-50 border-blue-200 p-3">
                  <div className="text-xs text-blue-600 mb-1">Scheduled</div>
                  <div className="text-2xl font-bold text-blue-700 tabular-nums">{hhmm(totalSched)}</div>
                  {utilPct != null && <div className="text-[11px] text-blue-500 mt-0.5">{utilPct}% utilized</div>}
                </div>
                <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3">
                  <div className="text-xs text-emerald-600 mb-1">Worked <span className="text-emerald-500">(shift − AUX)</span></div>
                  <div className="text-2xl font-bold text-emerald-700 tabular-nums">{hhmm(totalWorked)}</div>
                  <div className="text-[11px] text-emerald-500 mt-0.5">of {hhmm(totalShift)} on shift · {hhmm(totalPto)} PTO</div>
                </div>
                <div className={`rounded-lg border p-3 ${totalUnplan > 0 ? "bg-red-50 border-red-200" : "bg-card"}`}>
                  <div className={`text-xs mb-1 ${totalUnplan > 0 ? "text-red-600" : "text-muted-foreground"}`}>Unplanned Absent</div>
                  <div className={`text-2xl font-bold tabular-nums ${totalUnplan > 0 ? "text-red-700" : "text-foreground"}`}>{hhmm(totalUnplan)}</div>
                  <div className={`text-[11px] mt-0.5 ${totalUnplan > 0 ? "text-red-500" : "text-muted-foreground"}`}>unplanned absences</div>
                </div>
              </div>
            );
          })()}

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <p className="text-sm font-semibold mb-3">Employee-Level Roster &amp; Attendance Detail</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Quantum Client</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Start Date</TableHead>
                    <ColHead className="text-right" title="Scheduled" hint="shift length × work days" />
                    <ColHead className="text-right" title="Shift" hint="clocked in → out" />
                    <ColHead className="text-right" title="Worked" hint="shift − all AUX" />
                    <ColHead className="text-right" title="PTO" hint="approved leave" />
                    <ColHead className="text-right" title="Unplanned" hint="sched − worked − PTO" />
                    <TableHead className="text-right">Late/Early</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoursLoading ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : (hoursSummary as HoursSummaryRow[]).length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No data for {hoursMonth}.</TableCell></TableRow>
                  ) : (() => {
                    const rows = [...(hoursSummary as HoursSummaryRow[])].sort((a, b) => (a.role ?? "zzz").localeCompare(b.role ?? "zzz") || a.name.localeCompare(b.name));
                    const groups: Array<[string, HoursSummaryRow[]]> = hoursGroupByRole
                      ? Array.from(rows.reduce((m, r) => { const k = r.role ?? "No position set"; (m.get(k) ?? m.set(k, []).get(k)!).push(r); return m; }, new Map<string, HoursSummaryRow[]>()).entries())
                      : [["", rows]];

                    const statusColor = (status: string) => {
                      if (status === "active") return "text-emerald-700 bg-emerald-50 border-emerald-200";
                      if (status === "inactive") return "text-slate-500 bg-slate-50 border-slate-200";
                      return "text-amber-700 bg-amber-50 border-amber-200";
                    };

                    const renderRow = (row: HoursSummaryRow) => {
                      const utilPct = row.scheduledHrs > 0 ? Math.round((row.workedHrs / row.scheduledHrs) * 100) : null;
                      return (
                        <TableRow key={row.traineeCode} className={row.unplannedHrs > 0 ? "bg-red-50/30" : undefined}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{row.traineeCode}</div>
                          </TableCell>
                          <TableCell className="text-sm">{row.clientName ?? "—"}</TableCell>
                          <TableCell className="text-sm">{row.role ?? <span className="text-amber-600 text-xs font-medium">not set</span>}</TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">{fmtUS(row.startDate)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{hhmm(row.scheduledHrs)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">{hhmm(row.shiftHrs)}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-mono text-sm font-semibold">{hhmm(row.workedHrs)}</div>
                            {utilPct !== null && (
                              <div className={`text-xs ${utilPct >= 90 ? "text-emerald-600" : utilPct >= 75 ? "text-amber-500" : "text-red-500"}`}>
                                {utilPct}%
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.ptoHrs > 0 ? <span className="text-blue-600">{hhmm(row.ptoHrs)}</span> : <span className="text-muted-foreground">0:00</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.unplannedHrs > 0 ? <span className="text-red-600 font-semibold">{hhmm(row.unplannedHrs)}</span> : <span className="text-muted-foreground">0:00</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.lateEarly > 0 ? <span className="text-amber-600">{row.lateEarly}</span> : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColor(row.status)}`}>
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    };

                    return groups.flatMap(([role, list]) => {
                      const groupWorked = list.reduce((s, r) => s + r.workedHrs, 0);
                      const groupShift  = list.reduce((s, r) => s + r.shiftHrs, 0);
                      const groupSched  = list.reduce((s, r) => s + r.scheduledHrs, 0);
                      const groupUtil   = groupSched > 0 ? Math.round((groupWorked / groupSched) * 100) : null;
                      return [
                        ...(hoursGroupByRole ? [
                          <TableRow key={`g-${role}`} className="bg-muted/40 hover:bg-muted/40">
                            <TableCell colSpan={5} className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {role} <span className="font-normal text-muted-foreground/70">· {list.length} agent{list.length !== 1 ? "s" : ""}</span>
                            </TableCell>
                            <TableCell className="py-2 text-right"><span className="text-xs font-mono text-muted-foreground">{hhmm(groupShift)}</span></TableCell>
                            <TableCell className="py-2 text-right">
                              <span className="text-xs font-mono font-semibold">{hhmm(groupWorked)}</span>
                              {groupUtil != null && <span className={`ml-1 text-xs ${groupUtil >= 90 ? "text-emerald-600" : groupUtil >= 75 ? "text-amber-500" : "text-red-500"}`}>({groupUtil}%)</span>}
                            </TableCell>
                            <TableCell colSpan={4} />
                          </TableRow>,
                        ] : []),
                        ...list.map(renderRow),
                      ];
                    });
                  })()}
                </TableBody>
              </Table>
              <p className="text-[11px] text-muted-foreground mt-3">
                All times are H:MM. Scheduled = daily shift length × scheduled work days. Shift = total clocked time (clock-in → clock-out). Worked = Shift minus all AUX (break, lunch, bathroom, …); the % under it is Worked ÷ Scheduled. PTO = approved leave days × daily shift length. Unplanned = Scheduled − Worked − PTO. Late / Early = attendance exceptions in the month.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
