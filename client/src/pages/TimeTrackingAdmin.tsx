import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, CalendarOff, AlertTriangle, CheckCircle2, Activity, BarChart2, Download, Trash2, LogOut, Users } from "lucide-react";

type PtoReq = {
  id: number;
  traineeCode: string;
  agentName: string | null;
  requestType: string;
  startDate: string;
  endDate: string;
  halfDay: boolean | null;
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
const toLocalInput = (ms: number | null) => { if (ms == null) return ""; const d = new Date(ms); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

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

export default function TimeTrackingAdmin() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState("pto");
  const [excMonth, setExcMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const today = new Date().toISOString().slice(0, 10);
  const [auxDate, setAuxDate] = useState(today);
  const [auxAgentFilter, setAuxAgentFilter] = useState("");

  const currentMonth = new Date().toISOString().slice(0, 7);
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

        <TabsContent value="open" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">Everyone currently clocked in. Shifts never end on their own — if someone forgot to clock out, end it here (any open AUX is ended too).</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Clocked in</TableHead>
                    <TableHead>On shift</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(openShifts as Array<{ id: number; traineeCode: string; fullName: string | null; jobTitle: string | null; clockIn: number; state: string; auxSince: number | null }>).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nobody is clocked in.</TableCell></TableRow>
                  ) : (openShifts as Array<{ id: number; traineeCode: string; fullName: string | null; jobTitle: string | null; clockIn: number; state: string; auxSince: number | null }>).map(sft => {
                    const hrs = (Date.now() - sft.clockIn) / 3600000;
                    return (
                      <TableRow key={sft.id} className={hrs > 14 ? "bg-amber-50/50" : undefined}>
                        <TableCell>
                          <div className="font-medium">{sft.fullName || sft.traineeCode}</div>
                          <div className="text-xs font-mono text-muted-foreground">{sft.traineeCode}</div>
                        </TableCell>
                        <TableCell className="text-sm">{sft.jobTitle ?? "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{new Date(sft.clockIn).toLocaleString("en-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</TableCell>
                        <TableCell className="text-sm">{hrs.toFixed(1)}h{hrs > 14 && <span className="ml-1 text-xs text-amber-600">· likely forgot</span>}</TableCell>
                        <TableCell>
                          <Badge variant={sft.state === "available" ? "default" : "secondary"} className="capitalize text-xs">
                            {sft.state.replace(/_/g, " ")}{sft.auxSince ? ` · ${Math.floor((Date.now() - sft.auxSince) / 60000)}m` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="gap-1" disabled={adminClockOut.isPending}
                            onClick={() => { if (confirm(`Clock out ${sft.fullName || sft.traineeCode} now?`)) adminClockOut.mutate({ shiftId: sft.id }); }}>
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
        </TabsContent>

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
                          {req.requestType}{req.halfDay ? " (½)" : ""}
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
              const fmt = (ms: number | null) => ms == null ? "" : new Date(ms).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
              const header = ["Employee", "Quantum Client", "Role", "Date", "AUX Type", "Start", "End", "Duration (min)", "Note"];
              const lines = [header.join(","), ...rows.map(r => [
                esc(r.fullName ?? r.traineeCode), esc(r.clientName ?? ""), esc(r.jobTitle ?? ""),
                new Date(r.startTime).toLocaleDateString("en-US"), esc(r.auxType.replace(/_/g, " ")), fmt(r.startTime), fmt(r.endTime),
                r.durationMs != null ? Math.round(r.durationMs / 60000) : "", esc(r.note ?? ""),
              ].join(","))];
              const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `aux_logs_${hoursMonth}.csv`; a.click(); URL.revokeObjectURL(url);
            }}>
              <Download className="w-3.5 h-3.5" /> Export month ({hoursMonth})
            </Button>
          </div>
          {auxEdit && (
            <Card className="mb-4 border-primary/40">
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-xs font-medium block mb-1">Type</label>
                  <select className="w-full h-9 rounded-md border px-2 text-sm bg-background" value={auxEditForm.auxType} onChange={e => setAuxEditForm(f => ({ ...f, auxType: e.target.value }))}>
                    {["break", "lunch", "bathroom", "training", "meeting", "coaching", "system_down", "idle", "other"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
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
                    startTime: auxEditForm.start ? new Date(auxEditForm.start).getTime() : undefined,
                    endTime: auxEditForm.end ? new Date(auxEditForm.end).getTime() : null,
                    note: auxEditForm.note || null,
                  })}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAuxEdit(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-4">
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
                  {(() => {
                    const filtered = (auxLogs as AuxLogRow[]).filter(l =>
                      !auxAgentFilter || l.traineeCode.toLowerCase().includes(auxAgentFilter.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No AUX logs{auxDate ? ` for ${auxDate}` : ""}{auxAgentFilter ? ` matching "${auxAgentFilter}"` : ""}.
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return filtered.map(log => {
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
                            <Badge variant="outline" className="capitalize text-xs">
                              {log.auxType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {start.toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {end ? end.toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : (
                              <span className="text-amber-500 text-xs">Active</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{durStr}</TableCell>
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
                    });
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
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
                // Employee-Level Roster & Attendance Detail — the client report layout.
                const rows = hoursSummary as HoursSummaryRow[];
                const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
                const header = ["Employee", "Quantum Client", "Role", "Start Date", "Sched. Hrs", "Worked Hrs", "PTO Hrs", "Unplanned Hrs", "Late / Early", "Status"];
                const sorted = [...rows].sort((a, b) => (a.role ?? "zzz").localeCompare(b.role ?? "zzz") || a.name.localeCompare(b.name));
                const csvRows = [header.join(","), ...sorted.map(r => [
                  esc(r.name), esc(r.clientName ?? ""), esc(r.role ?? ""), esc(fmtUS(r.startDate)),
                  r.scheduledHrs, r.workedHrs, r.ptoHrs, r.unplannedHrs, r.lateEarly, esc(r.status),
                ].join(","))];
                const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
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
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <p className="text-sm font-semibold mb-2">Employee-Level Roster &amp; Attendance Detail</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Quantum Client</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="text-right">Sched. Hrs</TableHead>
                    <TableHead className="text-right">Worked Hrs</TableHead>
                    <TableHead className="text-right">PTO Hrs</TableHead>
                    <TableHead className="text-right">Unplanned Hrs</TableHead>
                    <TableHead className="text-right">Late / Early</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoursLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : (hoursSummary as HoursSummaryRow[]).length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No data for {hoursMonth}.</TableCell></TableRow>
                  ) : (() => {
                    const rows = [...(hoursSummary as HoursSummaryRow[])].sort((a, b) => (a.role ?? "zzz").localeCompare(b.role ?? "zzz") || a.name.localeCompare(b.name));
                    const groups: Array<[string, HoursSummaryRow[]]> = hoursGroupByRole
                      ? Array.from(rows.reduce((m, r) => { const k = r.role ?? "No position set"; (m.get(k) ?? m.set(k, []).get(k)!).push(r); return m; }, new Map<string, HoursSummaryRow[]>()).entries())
                      : [["", rows]];
                    const renderRow = (row: HoursSummaryRow) => {
                      const utilPct = row.scheduledHrs > 0 ? Math.round((row.workedHrs / row.scheduledHrs) * 100) : null;
                      return (
                        <TableRow key={row.traineeCode}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{row.traineeCode}</div>
                          </TableCell>
                          <TableCell className="text-sm">{row.clientName ?? "—"}</TableCell>
                          <TableCell className="text-sm">{row.role ?? <span className="text-amber-600">not set</span>}</TableCell>
                          <TableCell className="text-sm font-mono">{fmtUS(row.startDate)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.scheduledHrs}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm">{row.workedHrs}</span>
                            {utilPct !== null && <span className={`ml-1 text-xs ${utilPct >= 90 ? "text-green-600" : utilPct >= 75 ? "text-amber-500" : "text-red-500"}`}>({utilPct}%)</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.ptoHrs}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.unplannedHrs > 0 ? <span className="text-red-600">{row.unplannedHrs}</span> : 0}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.lateEarly}</TableCell>
                          <TableCell className="text-sm">{row.status}</TableCell>
                        </TableRow>
                      );
                    };
                    return groups.flatMap(([role, list]) => [
                      ...(hoursGroupByRole ? [
                        <TableRow key={`g-${role}`} className="bg-muted/40">
                          <TableCell colSpan={10} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{role} · {list.length}</TableCell>
                        </TableRow>,
                      ] : []),
                      ...list.map(renderRow),
                    ]);
                  })()}
                </TableBody>
              </Table>
              <p className="text-[11px] text-muted-foreground mt-3">
                Worked = clocked time minus AUX. PTO = approved leave days × scheduled daily hours. Unplanned = scheduled − worked − PTO. Late / Early = attendance exceptions in the month.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
