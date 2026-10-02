import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, CalendarOff, AlertTriangle, CheckCircle2, XCircle, Activity, BarChart2, Download } from "lucide-react";

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
};

type AuxLogRow = {
  id: number;
  traineeCode: string;
  auxType: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  note: string | null;
  createdAt: number;
};

type HoursSummaryRow = {
  traineeCode: string;
  name: string;
  scheduledHrs: number;
  workedHrs: number;
  shiftHrs: number;
  auxMinutes: Record<string, number>;
};

export default function TimeTrackingAdmin() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState("pto");
  const [excMonth, setExcMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const today = new Date().toISOString().slice(0, 10);
  const [auxDate, setAuxDate] = useState(today);
  const [auxAgentFilter, setAuxAgentFilter] = useState("");

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [hoursMonth, setHoursMonth] = useState(currentMonth);

  // Compute from/to for the selected month
  const hoursFrom = hoursMonth + "-01";
  const hoursTo = (() => {
    const [y, m] = hoursMonth.split("-").map(Number);
    const last = new Date(y!, m!, 0).getDate(); // day 0 of next month = last of this
    return `${hoursMonth}-${String(last).padStart(2, "0")}`;
  })();

  const { data: ptoRequests = [] } = trpc.timeTracking.allPtoRequests.useQuery({ status: "all" });
  const { data: exceptions = [] } = trpc.timeTracking.allExceptions.useQuery({ month: excMonth });
  const { data: auxLogs = [] } = trpc.timeTracking.auxLogs.useQuery({ date: auxDate || undefined });
  const { data: hoursSummary = [], isFetching: hoursLoading } = trpc.timeTracking.workedSummary.useQuery(
    { from: hoursFrom, to: hoursTo },
    { enabled: tab === "hours" }
  );

  const reviewPto = trpc.timeTracking.reviewPto.useMutation({
    onSuccess: () => {
      utils.timeTracking.allPtoRequests.invalidate();
      toast.success("PTO request updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = (ptoRequests as PtoReq[]).filter(r => r.status === "pending").length;

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
            <CalendarOff className="w-3.5 h-3.5" /> PTO Requests
            {pending > 0 && (
              <Badge className="ml-1 text-xs px-1.5 py-0 bg-red-500 text-white">{pending}</Badge>
            )}
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
        </TabsList>

        <TabsContent value="pto" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
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
                          {req.status === "pending" && (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                disabled={reviewPto.isPending}
                                onClick={() => reviewPto.mutate({ id: req.id, status: "approved" })}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                disabled={reviewPto.isPending}
                                onClick={() => reviewPto.mutate({ id: req.id, status: "rejected" })}
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </Button>
                            </div>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(exceptions as ExceptionRow[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Code</TableHead>
                    <TableHead>AUX Type</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Note</TableHead>
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
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                          <TableCell className="font-mono text-xs">{log.traineeCode}</TableCell>
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
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 ml-auto"
              disabled={(hoursSummary as HoursSummaryRow[]).length === 0}
              onClick={() => {
                const rows = hoursSummary as HoursSummaryRow[];
                const auxTypes = Array.from(new Set(rows.flatMap(r => Object.keys(r.auxMinutes)))).sort();
                const headers = ["Agent Code", "Name", "Scheduled Hrs", "Shift Hrs", "Worked Hrs", ...auxTypes.map(t => t.replace(/_/g, " ") + " (min)")];
                const csvRows = [
                  headers.join(","),
                  ...rows.map(r => [
                    r.traineeCode,
                    `"${r.name}"`,
                    r.scheduledHrs,
                    r.shiftHrs,
                    r.workedHrs,
                    ...auxTypes.map(t => r.auxMinutes[t] ?? 0),
                  ].join(","))
                ];
                const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `hours_${hoursMonth}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Shift Hrs</TableHead>
                    <TableHead className="text-right">Worked Hrs</TableHead>
                    <TableHead className="text-right">Break (min)</TableHead>
                    <TableHead className="text-right">Lunch (min)</TableHead>
                    <TableHead className="text-right">Training (min)</TableHead>
                    <TableHead className="text-right">System Down (min)</TableHead>
                    <TableHead className="text-right">Idle (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoursLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (hoursSummary as HoursSummaryRow[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No data for {hoursMonth}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (hoursSummary as HoursSummaryRow[]).map(row => {
                      const utilPct = row.scheduledHrs > 0
                        ? Math.round((row.workedHrs / row.scheduledHrs) * 100)
                        : null;
                      return (
                        <TableRow key={row.traineeCode}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{row.traineeCode}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.scheduledHrs}h</TableCell>
                          <TableCell className="text-right font-mono text-sm">{row.shiftHrs}h</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm">{row.workedHrs}h</span>
                            {utilPct !== null && (
                              <span className={`ml-1 text-xs ${utilPct >= 90 ? "text-green-600" : utilPct >= 75 ? "text-amber-500" : "text-red-500"}`}>
                                ({utilPct}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.auxMinutes["break"] ?? 0}</TableCell>
                          <TableCell className="text-right text-sm">{row.auxMinutes["lunch"] ?? 0}</TableCell>
                          <TableCell className="text-right text-sm">{row.auxMinutes["training"] ?? 0}</TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={row.auxMinutes["system_down"] ? "text-red-600 font-medium" : ""}>
                              {row.auxMinutes["system_down"] ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.auxMinutes["idle"] ?? 0}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
