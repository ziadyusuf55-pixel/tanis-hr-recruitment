import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, Coffee, CalendarOff, AlertTriangle, LogIn, LogOut } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const AUX_TYPES = [
  { value: "break", label: "Break" },
  { value: "lunch", label: "Lunch" },
  { value: "training", label: "Training" },
  { value: "meeting", label: "Meeting" },
  { value: "bathroom", label: "Bathroom" },
  { value: "system_down", label: "System / IT Down" },
  { value: "idle", label: "Idle / No Work" },
  { value: "other", label: "Other" },
];

const PTO_TYPES = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "emergency", label: "Emergency" },
  { value: "unpaid", label: "Unpaid" },
];

type AuxLog = {
  id: number;
  auxType: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
};

type PtoReq = {
  id: number;
  requestType: string;
  startDate: string;
  endDate: string;
  status: string;
};

export default function TimeTrackerPage() {
  const utils = trpc.useUtils();
  const today = new Date().toISOString().slice(0, 10);

  const { data: access, isLoading: accessLoading } = trpc.timeTracking.checkAccess.useQuery();
  const { data: auxLogs = [], refetch: refetchAux } = trpc.timeTracking.myAuxLogs.useQuery();
  const { data: todayShift, refetch: refetchShift } = trpc.timeTracking.myShiftToday.useQuery();
  const [auxType, setAuxType] = useState("break");

  const clockIn = trpc.timeTracking.clockIn.useMutation({
    onSuccess: () => { refetchShift(); toast.success("Clocked in — have a great shift!"); },
    onError: (e) => toast.error(e.message),
  });
  const clockOut = trpc.timeTracking.clockOut.useMutation({
    onSuccess: (res) => {
      refetchShift();
      const hrs = Math.floor((res.durationMs ?? 0) / 3600000);
      const mins = Math.floor(((res.durationMs ?? 0) % 3600000) / 60000);
      toast.success(`Clocked out — ${hrs}h ${mins}m shift logged`);
    },
    onError: (e) => toast.error(e.message),
  });

  const startAux = trpc.timeTracking.startAux.useMutation({
    onSuccess: () => { refetchAux(); toast.success("AUX started"); },
    onError: (e) => toast.error(e.message),
  });
  const endAux = trpc.timeTracking.endAux.useMutation({
    onSuccess: (res) => {
      refetchAux();
      const mins = Math.floor((res.durationMs ?? 0) / 60000);
      toast.success(`AUX ended — ${mins}m logged`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Clocked-in state: shift exists and has no clockOut yet
  const isClockedIn = !!todayShift && !todayShift.clockOut;

  const [showPto, setShowPto] = useState(false);
  const [ptoForm, setPtoForm] = useState({ requestType: "annual", startDate: today, endDate: today, halfDay: false, reason: "" });
  const { data: myPto = [] } = trpc.timeTracking.myPtoRequests.useQuery();
  const submitPto = trpc.timeTracking.submitPto.useMutation({
    onSuccess: () => {
      utils.timeTracking.myPtoRequests.invalidate();
      setShowPto(false);
      toast.success("PTO request submitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showException, setShowException] = useState(false);
  const [excForm, setExcForm] = useState({ date: today, exceptionType: "late", scheduledTime: "", actualTime: "", note: "" });
  const logException = trpc.timeTracking.logException.useMutation({
    onSuccess: () => {
      setShowException(false);
      toast.success("Exception logged");
    },
    onError: (e) => toast.error(e.message),
  });

  const logs = auxLogs as AuxLog[];
  const currentActive = logs.find(l => !l.endTime);

  function fmtDuration(startMs: number, endMs?: number | null) {
    const dur = (endMs ?? Date.now()) - startMs;
    const mins = Math.floor(dur / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  }

  // Access gate — must come after all hooks
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!access?.allowed) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Not Available</h1>
        <p className="text-sm text-muted-foreground">
          The Time Tracker is currently only available for <strong>Quantum</strong> agents.
        </p>
        {access?.clientName && (
          <p className="text-xs text-muted-foreground">Your account is linked to: <span className="font-medium">{access.clientName}</span></p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Time Tracker</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Clock In / Clock Out */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {isClockedIn
              ? <LogOut className="w-4 h-4 text-red-500" />
              : <LogIn className="w-4 h-4 text-green-600" />}
            Work Shift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isClockedIn ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">Shift in progress</span>
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-100 animate-pulse">
                  {fmtDuration(todayShift!.clockIn)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Clocked in at {new Date(todayShift!.clockIn).toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => clockOut.mutate()}
                disabled={clockOut.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" /> Clock Out
              </Button>
            </div>
          ) : todayShift?.clockOut ? (
            <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
              <p className="text-sm font-medium">Shift complete</p>
              <p className="text-xs text-muted-foreground">
                {new Date(todayShift.clockIn).toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit" })}
                {" → "}
                {new Date(todayShift.clockOut).toLocaleTimeString("en-EG", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {fmtDuration(todayShift.clockIn, todayShift.clockOut)}
              </p>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => clockIn.mutate()}
              disabled={clockIn.isPending}
            >
              <LogIn className="w-4 h-4 mr-2" /> Clock In
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AUX Tracker */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Coffee className="w-4 h-4" /> AUX Time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isClockedIn && !todayShift?.clockOut && (
            <p className="text-xs text-muted-foreground text-center py-1">
              Clock in first to log AUX time.
            </p>
          )}
          {currentActive ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{currentActive.auxType.replace(/_/g, " ")} in progress</span>
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100 animate-pulse">
                  {fmtDuration(currentActive.startTime)}
                </Badge>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => endAux.mutate()}
                disabled={endAux.isPending}
              >
                End {currentActive.auxType.replace(/_/g, " ")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={auxType} onValueChange={setAuxType}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                onClick={() => startAux.mutate({ auxType })}
                disabled={startAux.isPending || !isClockedIn}
                title={!isClockedIn ? "Clock in before starting AUX" : undefined}
              >
                Start
              </Button>
            </div>
          )}

          {/* Today's AUX history */}
          {logs.filter(l => l.endTime).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-2">Today's AUX</p>
              {logs.filter(l => l.endTime).map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="capitalize">{log.auxType.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground text-xs">{fmtDuration(log.startTime, log.endTime)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setShowPto(true)}>
          <CalendarOff className="w-5 h-5" />
          <span className="text-sm">Request PTO</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setShowException(true)}>
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">Log Exception</span>
        </Button>
      </div>

      {/* My PTO requests */}
      {(myPto as PtoReq[]).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">My PTO Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {(myPto as PtoReq[]).map(req => (
              <div key={req.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="text-sm font-medium capitalize">{req.requestType}</span>
                  <p className="text-xs text-muted-foreground">{req.startDate} → {req.endDate}</p>
                </div>
                <Badge
                  variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                  className="text-xs capitalize"
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PTO Dialog */}
      <Dialog open={showPto} onOpenChange={setShowPto}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request PTO</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
              <Select value={ptoForm.requestType} onValueChange={v => setPtoForm(f => ({ ...f, requestType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PTO_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
                <Input type="date" value={ptoForm.startDate} onChange={e => setPtoForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">To</label>
                <Input type="date" value={ptoForm.endDate} onChange={e => setPtoForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="halfDay"
                checked={ptoForm.halfDay}
                onChange={e => setPtoForm(f => ({ ...f, halfDay: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="halfDay" className="text-sm">Half day</label>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Reason (optional)</label>
              <Textarea
                placeholder="Reason for leave…"
                value={ptoForm.reason}
                onChange={e => setPtoForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPto(false)}>Cancel</Button>
            <Button
              disabled={submitPto.isPending}
              onClick={() => submitPto.mutate({
                requestType: ptoForm.requestType as "annual" | "sick" | "emergency" | "unpaid",
                startDate: ptoForm.startDate,
                endDate: ptoForm.endDate,
                halfDay: ptoForm.halfDay,
                reason: ptoForm.reason || undefined,
              })}
            >
              {submitPto.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception Dialog */}
      <Dialog open={showException} onOpenChange={setShowException}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Attendance Exception</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
              <Input type="date" value={excForm.date} onChange={e => setExcForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
              <Select value={excForm.exceptionType} onValueChange={v => setExcForm(f => ({ ...f, exceptionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="late">Late Arrival</SelectItem>
                  <SelectItem value="early_departure">Early Departure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Scheduled Time</label>
                <Input type="time" value={excForm.scheduledTime} onChange={e => setExcForm(f => ({ ...f, scheduledTime: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Actual Time</label>
                <Input type="time" value={excForm.actualTime} onChange={e => setExcForm(f => ({ ...f, actualTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Note</label>
              <Textarea
                placeholder="Brief note…"
                value={excForm.note}
                onChange={e => setExcForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowException(false)}>Cancel</Button>
            <Button
              disabled={logException.isPending}
              onClick={() => logException.mutate({
                date: excForm.date,
                exceptionType: excForm.exceptionType as "late" | "early_departure",
                scheduledTime: excForm.scheduledTime || undefined,
                actualTime: excForm.actualTime || undefined,
                note: excForm.note || undefined,
              })}
            >
              {logException.isPending ? "Logging…" : "Log Exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
