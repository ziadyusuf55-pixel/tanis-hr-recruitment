import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserCircle, Save } from "lucide-react";

const BRAND = "#FF6A13";

/**
 * My Profile — self-service. A logged-in employee (manager, TL, HR…) edits
 * their own personal details. They can't touch salary, status or role.
 * Their login is linked to their employee record via openId.
 */
export default function MyProfile() {
  const utils = trpc.useUtils();
  const { data: me, isLoading } = trpc.employees.myProfile.useQuery();

  const [f, setF] = useState({
    phone: "", address: "", emergencyContactName: "", emergencyContactPhone: "",
    emergencyContactRelation: "", dateOfBirth: "", city: "",
  });

  useEffect(() => {
    if (!me) return;
    const m = me as unknown as Record<string, string | null>;
    setF({
      phone: m.phone ?? "", address: m.address ?? "",
      emergencyContactName: m.emergencyContactName ?? "",
      emergencyContactPhone: m.emergencyContactPhone ?? "",
      emergencyContactRelation: m.emergencyContactRelation ?? "",
      dateOfBirth: m.dateOfBirth ?? "", city: m.city ?? "",
    });
  }, [me]);

  const save = trpc.employees.updateMyProfile.useMutation({
    onSuccess: () => { utils.employees.myProfile.invalidate(); toast.success("Profile updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  if (!me) {
    return (
      <div className="p-6 max-w-lg">
        <Card><CardContent className="p-6 text-center space-y-2">
          <UserCircle className="w-9 h-9 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">Your login isn't linked to a profile yet.</p>
          <p className="text-xs text-muted-foreground">
            Ask an owner to add you in <strong>Settings → Team Roles & Access</strong> and assign you a role. Once you have a role, your profile will appear here.
          </p>
        </CardContent></Card>
      </div>
    );
  }

  const m = me as unknown as Record<string, string | null>;
  const isAdminSource = (me as unknown as Record<string, unknown>)._source === "admin";
  // Normalise fields for both workforce and admin sources
  const displayName = m.fullName || m.name || m.alias || "—";
  const displayEmail = m.email || "—";
  const displayRole = m.role || m.employeeType || m.jobTitle || "—";
  const F = ({ label, k, type = "text" }: { label: string; k: keyof typeof f; type?: string }) => (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserCircle className="w-5 h-5" style={{ color: BRAND }} /> My Profile
        </h1>
        <p className="text-xs text-muted-foreground">Keep your personal details up to date.</p>
      </div>

      {/* Read-only identity */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: BRAND }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">{displayEmail}</p>
          </div>
          <div className="ml-auto flex gap-1.5">
            <Badge variant="outline">{displayRole}</Badge>
            {isAdminSource && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Admin Account</Badge>}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Name, email, job title and role are managed by HR — contact an owner to change them.
        </p>
      </CardContent></Card>

      {/* Editable */}
      <Card><CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold">Personal details</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Phone" k="phone" />
          <F label="City" k="city" />
          <F label="Date of birth" k="dateOfBirth" type="date" />
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Address</p>
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </div>
          <F label="Emergency Contact Name" k="emergencyContactName" />
          <F label="Emergency Contact Phone" k="emergencyContactPhone" />
          <F label="Emergency Contact Relation" k="emergencyContactRelation" />
        </div>

        <p className="text-sm font-semibold pt-2">Emergency contact <span className="font-normal text-muted-foreground">· جهة اتصال للطوارئ</span></p>
        <div className="grid sm:grid-cols-3 gap-3">
          <F label="Name" k="emergencyContactName" />
          <F label="Phone" k="emergencyContactPhone" />
          <F label="Relationship · صلة القرابة" k="emergencyContactRelation" />
        </div>

        <Button onClick={() => save.mutate(f)} disabled={save.isPending} style={{ background: BRAND }} className="text-white">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </CardContent></Card>

      {/* Leave requests section */}
      <MyLeaveSection />
    </div>
  );
}

function MyLeaveSection() {
  const utils = trpc.useUtils();
  const { data: leaveData } = trpc.leave.getMyLeaves.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });

  const submitMutation = trpc.leave.requestMyLeave.useMutation({
    onSuccess: () => { utils.leave.getMyLeaves.invalidate(); setShowForm(false); setForm({ startDate: "", endDate: "", reason: "" }); toast.success("Leave request submitted"); },
    onError: (e: unknown) => toast.error((e as { message?: string }).message ?? "Error"),
  });

  const days = form.startDate && form.endDate
    ? Math.max(1, Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1)
    : 0;

  const bal = leaveData?.balance;
  const reqs = leaveData?.requests ?? [];

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">My Leave</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Request Leave"}
        </Button>
      </div>

      {/* Balance */}
      {bal && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground">Casual Leave</p>
            <p className="text-xl font-bold mt-0.5">{bal.casualTotal - bal.casualUsed} <span className="text-xs font-normal text-muted-foreground">/ {bal.casualTotal}</span></p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground">Annual Leave</p>
            <p className="text-xl font-bold mt-0.5">{bal.annualTotal - bal.annualUsed} <span className="text-xs font-normal text-muted-foreground">/ {bal.annualTotal}</span></p>
          </div>
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">End Date</label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reason (optional)</label>
            <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for leave..." />
          </div>
          {days > 0 && <p className="text-xs text-muted-foreground">{days} day(s)</p>}
          <Button size="sm" disabled={!form.startDate || !form.endDate || submitMutation.isPending}
            onClick={() => submitMutation.mutate({ startDate: form.startDate, endDate: form.endDate, days, reason: form.reason || undefined })}>
            {submitMutation.isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </div>
      )}

      {/* Request history */}
      {reqs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recent requests</p>
          {(reqs as Array<Record<string,unknown>>).slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
              <div>
                <p className="font-medium">{String(r.startDate ?? "")} → {String(r.endDate ?? "")}</p>
                <p className="text-xs text-muted-foreground">{String(r.days ?? 1)} day(s){r.reason ? ` · ${String(r.reason)}` : ""}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {String(r.status ?? "pending")}
              </span>
            </div>
          ))}
        </div>
      )}
      {reqs.length === 0 && !showForm && <p className="text-xs text-muted-foreground text-center py-2">No leave requests yet</p>}
    </CardContent></Card>
  );
}
