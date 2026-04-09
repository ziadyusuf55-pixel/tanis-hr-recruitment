import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Plus, MoreHorizontal, Pencil, Trash2, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";

type JobStatus = "open" | "closed" | "paused";

type JobForm = {
  title: string;
  department: string;
  location: string;
  description: string;
  status: JobStatus;
};

const EMPTY_FORM: JobForm = {
  title: "",
  department: "",
  location: "",
  description: "",
  status: "open",
};

const STATUS_BADGE: Record<JobStatus, string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-red-50 text-red-600 border-red-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function Jobs() {
  const utils = trpc.useUtils();
  const { data: jobs, isLoading } = trpc.jobs.list.useQuery();
  const createJob = trpc.jobs.create.useMutation({
    onSuccess: () => { utils.jobs.list.invalidate(); toast.success("Job posting created"); setOpen(false); setForm(EMPTY_FORM); },
    onError: () => toast.error("Failed to create job posting"),
  });
  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => { utils.jobs.list.invalidate(); toast.success("Job posting updated"); setOpen(false); setEditing(null); },
    onError: () => toast.error("Failed to update job posting"),
  });
  const deleteJob = trpc.jobs.delete.useMutation({
    onSuccess: () => { utils.jobs.list.invalidate(); toast.success("Job posting deleted"); },
    onError: () => toast.error("Failed to delete job posting"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (job: typeof jobs extends (infer T)[] | undefined ? T : never) => {
    if (!job) return;
    setEditing((job as { id: number }).id);
    setForm({
      title: (job as { title: string }).title,
      department: (job as { department: string | null }).department ?? "",
      location: (job as { location: string | null }).location ?? "",
      description: (job as { description: string | null }).description ?? "",
      status: (job as { status: JobStatus }).status,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("Job title is required"); return; }
    const payload = {
      title: form.title.trim(),
      department: form.department.trim() || undefined,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
    };
    if (editing !== null) {
      updateJob.mutate({ id: editing, data: payload });
    } else {
      createJob.mutate(payload);
    }
  };

  const isSubmitting = createJob.isPending || updateJob.isPending;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Job Postings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${jobs?.length ?? 0} position${jobs?.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 h-9">
          <Plus className="h-4 w-4" /> New Position
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-card border border-border rounded-xl p-5 card-hover group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[job.status]}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {job.department && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {job.department}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {job.location}
                      </span>
                    )}
                    <span className="text-muted-foreground/60">
                      Added {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openEdit(job)} className="cursor-pointer">
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirm(job.id)}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
          <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No job postings yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first open position to start tracking candidates.</p>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Create Position
          </Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing !== null ? "Edit Position" : "New Position"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Job Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Senior Customer Success Manager"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g. Operations"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Alexandria, Egypt"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as JobStatus })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the role and requirements..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editing !== null ? "Save Changes" : "Create Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Position</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this job posting? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteJob.isPending}
              onClick={() => {
                if (deleteConfirm !== null) {
                  deleteJob.mutate({ id: deleteConfirm });
                  setDeleteConfirm(null);
                }
              }}
            >
              {deleteJob.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
