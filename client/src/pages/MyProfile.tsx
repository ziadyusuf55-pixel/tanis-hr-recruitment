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
            Ask an owner to link you in Settings → Management. Once linked, you can edit your details here.
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
        {isAdminSource && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Admin accounts have limited profile fields. Full HR profile is managed via Settings → Management.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Phone" k="phone" />
          {!isAdminSource && <F label="City" k="city" />}
          {!isAdminSource && <F label="Date of birth" k="dateOfBirth" type="date" />}
          {!isAdminSource && <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Address</p>
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </div>}
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
    </div>
  );
}
