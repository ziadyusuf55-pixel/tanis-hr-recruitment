import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GraduationCap, Plus, Lightbulb, ChevronDown, ChevronRight, Users, CheckCircle2, ClipboardCheck, Trash2, Check } from "lucide-react";

const BRAND = "#FF6A13";

type Course = {
  id: number; title: string; description: string | null; category: string | null;
  remediesViolation: string | null; isMandatory: boolean; isPublished: boolean; passMark: number | null;
};

/**
 * Tanis Academy (admin) — build courses, assign them, and act on suggestions
 * the Hub raises from real performance data (violations, logouts, coaching).
 */
export default function Academy() {
  const [tab, setTab] = useState<"courses" | "suggestions">("courses");
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="w-5 h-5" style={{ color: BRAND }} /> Tanis Academy
        </h1>
        <p className="text-xs text-muted-foreground">Training courses for the floor — build, assign, and track completion.</p>
      </div>

      <div className="flex gap-1 border-b">
        {(["courses", "suggestions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize"
            style={{ borderColor: tab === t ? BRAND : "transparent", color: tab === t ? BRAND : undefined }}>
            {t === "suggestions" ? "Who needs training" : "Courses"}
          </button>
        ))}
      </div>

      {tab === "courses" ? <CoursesTab /> : <SuggestionsTab />}
    </div>
  );
}

function CoursesTab() {
  const utils = trpc.useUtils();
  const { data: courses = [], isLoading } = trpc.academy.listCourses.useQuery({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", remediesViolation: "" });

  const create = trpc.academy.createCourse.useMutation({
    onSuccess: () => { utils.academy.listCourses.invalidate(); toast.success("Course created"); setOpen(false); setForm({ title: "", description: "", category: "", remediesViolation: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const publish = trpc.academy.publishCourse.useMutation({
    onSuccess: () => { utils.academy.listCourses.invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setOpen(o => !o)} style={{ background: BRAND }} className="text-white">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> New course
      </Button>

      {open && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Title</p>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Script Compliance Essentials" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Compliance" />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">
                Remedies violation <span className="text-[10px]">(exact name from the Quality sheet — enables auto-suggestions)</span>
              </p>
              <Input value={form.remediesViolation} onChange={e => setForm({ ...form, remediesViolation: e.target.value })} placeholder="Skipping Script" />
            </div>
          </div>
          <Button size="sm" disabled={!form.title || create.isPending}
            onClick={() => create.mutate({
              title: form.title,
              description: form.description || undefined,
              category: form.category || undefined,
              remediesViolation: form.remediesViolation || undefined,
            })}>
            {create.isPending ? "Creating…" : "Create course"}
          </Button>
        </CardContent></Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : courses.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">No courses yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first course to get started.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(courses as Course[]).map(c => <CourseRow key={c.id} course={c} onPublish={publish.mutate} />)}
        </div>
      )}
    </div>
  );
}

function CourseRow({ course, onPublish }: { course: Course; onPublish: (v: { id: number; isPublished: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: modules = [] } = trpc.academy.listModules.useQuery({ courseId: course.id }, { enabled: open });
  const { data: assignments = [] } = trpc.academy.listAssignments.useQuery({ courseId: course.id }, { enabled: open });
  const { data: agents = [] } = trpc.workforce.list.useQuery({}, { enabled: open });

  const [mod, setMod] = useState({ title: "", contentType: "link" as "video" | "pdf" | "link" | "text", contentUrl: "" });
  const addModule = trpc.academy.addModule.useMutation({
    onSuccess: () => { utils.academy.listModules.invalidate({ courseId: course.id }); toast.success("Module added"); setMod({ title: "", contentType: "link", contentUrl: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const assign = trpc.academy.assign.useMutation({
    onSuccess: (r) => { utils.academy.listAssignments.invalidate({ courseId: course.id }); toast.success(`Assigned to ${r.created} agent(s)`); },
    onError: (e) => toast.error(e.message),
  });

  const done = (assignments as { status: string }[]).filter(a => a.status === "completed").length;

  return (
    <Card><CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="flex items-start gap-2 text-left flex-1 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{course.title}</p>
            <p className="text-xs text-muted-foreground">
              {course.category || "Uncategorised"}
              {course.remediesViolation ? ` · remedies "${course.remediesViolation}"` : ""}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {assignments.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {done}/{assignments.length}
            </span>
          )}
          <Badge variant={course.isPublished ? "default" : "outline"} className="text-[10px]">
            {course.isPublished ? "Published" : "Draft"}
          </Badge>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => onPublish({ id: course.id, isPublished: !course.isPublished })}>
            {course.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-3 border-t space-y-4">
          <div>
            <p className="text-xs font-semibold mb-2">Modules ({modules.length})</p>
            {modules.length > 0 && (
              <div className="space-y-1 mb-2">
                {(modules as { id: number; title: string; contentType: string }[]).map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    <span className="flex-1 truncate">{m.title}</span>
                    <Badge variant="outline" className="text-[10px]">{m.contentType}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <Input className="h-8 flex-1 min-w-[140px]" placeholder="Module title" value={mod.title} onChange={e => setMod({ ...mod, title: e.target.value })} />
              <select className="border rounded-md px-2 h-8 text-sm bg-background" value={mod.contentType}
                onChange={e => setMod({ ...mod, contentType: e.target.value as typeof mod.contentType })}>
                {["link", "video", "pdf", "text"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input className="h-8 flex-1 min-w-[160px]" placeholder="URL (video / PDF / link)" value={mod.contentUrl} onChange={e => setMod({ ...mod, contentUrl: e.target.value })} />
              <Button size="sm" className="h-8" disabled={!mod.title || addModule.isPending}
                onClick={() => addModule.mutate({ courseId: course.id, title: mod.title, contentType: mod.contentType, contentUrl: mod.contentUrl || undefined })}>
                Add
              </Button>
            </div>
          </div>

          <QuizBuilder courseId={course.id} passMark={course.passMark ?? 0} />

          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Assign</p>
            <div className="flex flex-wrap gap-2 items-center">
              <select className="border rounded-md px-2 py-1.5 text-sm bg-background" defaultValue=""
                onChange={e => { if (e.target.value) { assign.mutate({ courseId: course.id, traineeCodes: [e.target.value] }); e.target.value = ""; } }}>
                <option value="">Assign to an agent…</option>
                {(agents as { traineeCode: string; alias: string | null; fullName: string | null }[]).map(a => (
                  <option key={a.traineeCode} value={a.traineeCode}>{a.alias || a.fullName || a.traineeCode}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={assign.isPending}
                onClick={() => assign.mutate({
                  courseId: course.id,
                  traineeCodes: (agents as { traineeCode: string }[]).map(a => a.traineeCode),
                })}>
                Assign to everyone
              </Button>
              {assignments.length > 0 && <span className="text-xs text-muted-foreground">{assignments.length} assigned · {done} completed</span>}
            </div>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}

/** Assessment builder — pass mark + multiple-choice questions for one course.
 *  Agents must score >= pass mark (after finishing all modules) to complete
 *  the course. Pass mark 0 = no assessment, course completes on modules alone. */
function QuizBuilder({ courseId, passMark }: { courseId: number; passMark: number }) {
  const utils = trpc.useUtils();
  const { data: questions = [], isLoading } = trpc.academy.listQuizQuestions.useQuery({ courseId });
  const [mark, setMark] = useState(String(passMark));
  const [q, setQ] = useState({ question: "", options: ["", "", "", ""], correctIndex: 0 });

  const invalidate = () => { utils.academy.listQuizQuestions.invalidate({ courseId }); utils.academy.listCourses.invalidate(); };
  const setPass = trpc.academy.setPassMark.useMutation({
    onSuccess: () => { invalidate(); toast.success("Pass mark saved"); },
    onError: (e) => toast.error(e.message),
  });
  const addQ = trpc.academy.addQuizQuestion.useMutation({
    onSuccess: () => { invalidate(); toast.success("Question added"); setQ({ question: "", options: ["", "", "", ""], correctIndex: 0 }); },
    onError: (e) => toast.error(e.message),
  });
  const delQ = trpc.academy.deleteQuizQuestion.useMutation({
    onSuccess: () => { invalidate(); toast.success("Question removed"); },
    onError: (e) => toast.error(e.message),
  });

  const filledOptions = q.options.map(o => o.trim()).filter(Boolean);
  const canAdd = q.question.trim().length > 0 && filledOptions.length >= 2 && q.options[q.correctIndex]?.trim();

  type Question = { id: number; question: string; options: string[]; correctIndex: number };

  return (
    <div>
      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
        <ClipboardCheck className="w-3.5 h-3.5" /> Assessment ({questions.length} question{questions.length === 1 ? "" : "s"})
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">Pass mark</span>
        <Input className="h-8 w-20" type="number" min={0} max={100} value={mark} onChange={e => setMark(e.target.value)} />
        <span className="text-xs text-muted-foreground">%</span>
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={setPass.isPending}
          onClick={() => {
            const v = Math.max(0, Math.min(100, Number(mark) || 0));
            setMark(String(v));
            setPass.mutate({ courseId, passMark: v });
          }}>
          Save
        </Button>
        {(Number(mark) || 0) === 0 && (
          <span className="text-[11px] text-muted-foreground">0 = no assessment — course completes on modules alone</span>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground mb-2">Loading questions…</p>
      ) : questions.length > 0 && (
        <div className="space-y-2 mb-3">
          {(questions as Question[]).map((question, qi) => (
            <div key={question.id} className="rounded-md border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium flex-1">{qi + 1}. {question.question}</p>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                  disabled={delQ.isPending} onClick={() => delQ.mutate({ id: question.id })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="mt-1.5 grid sm:grid-cols-2 gap-1">
                {question.options.map((opt, oi) => (
                  <div key={oi} className={`text-[11px] flex items-center gap-1.5 px-2 py-1 rounded ${oi === question.correctIndex ? "bg-green-50 text-green-700 font-medium" : "text-muted-foreground"}`}>
                    {oi === question.correctIndex ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                    <span className="truncate">{String.fromCharCode(65 + oi)}. {opt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-dashed p-2.5 space-y-2">
        <Input className="h-8" placeholder="New question…" value={q.question}
          onChange={e => setQ({ ...q, question: e.target.value })} />
        <div className="grid sm:grid-cols-2 gap-2">
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <button type="button" title="Mark as correct answer"
                onClick={() => setQ({ ...q, correctIndex: oi })}
                className={`h-8 w-8 shrink-0 rounded-md border flex items-center justify-center ${q.correctIndex === oi ? "bg-green-600 border-green-600 text-white" : "text-muted-foreground"}`}>
                <Check className="w-3.5 h-3.5" />
              </button>
              <Input className="h-8" placeholder={`Option ${String.fromCharCode(65 + oi)}${oi < 2 ? "" : " (optional)"}`}
                value={opt}
                onChange={e => {
                  const options = [...q.options];
                  options[oi] = e.target.value;
                  setQ({ ...q, options });
                }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Tick the green box next to the correct answer. Min 2 options.</p>
          <Button size="sm" className="h-8 text-xs" disabled={!canAdd || addQ.isPending}
            onClick={() => {
              // Keep only filled options; remap correctIndex to the compacted list
              const kept: string[] = [];
              let newCorrect = -1;
              q.options.forEach((o, oi) => {
                const t = o.trim();
                if (t) { if (oi === q.correctIndex) newCorrect = kept.length; kept.push(t); }
              });
              if (newCorrect < 0) { toast.error("Correct answer can't be empty"); return; }
              addQ.mutate({ courseId, question: q.question.trim(), options: kept, correctIndex: newCorrect });
            }}>
            {addQ.isPending ? "Adding…" : "Add question"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Agents the Hub thinks need training, based on their actual record. */
function SuggestionsTab() {
  const utils = trpc.useUtils();
  const { data: sugg = [], isLoading } = trpc.academy.suggestions.useQuery();
  const { data: courses = [] } = trpc.academy.listCourses.useQuery({});
  const assign = trpc.academy.assign.useMutation({
    onSuccess: () => { utils.academy.listAssignments.invalidate(); toast.success("Course assigned"); },
    onError: (e) => toast.error(e.message),
  });

  type Sugg = { traineeCode: string; crdts: string; alias: string | null; reason: string; courseId: number | null; courseTitle: string | null };

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Raised from the last 60 days of quality violations, client logouts and coaching sessions.
          Anyone hitting the same issue 3+ times shows up here.
        </p>
      </div>

      {sugg.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm font-medium">Nobody flagged for training.</p>
          <p className="text-xs text-muted-foreground mt-1">No repeated violations, logouts or coaching in the last 60 days.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(sugg as Sugg[]).map((s, i) => (
            <Card key={`${s.crdts}-${i}`}><CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.alias || "—"} <span className="text-xs text-muted-foreground">· {s.crdts}</span></p>
                <p className="text-xs text-red-600">{s.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.courseTitle ? (
                  <>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">→ {s.courseTitle}</span>
                    <Button size="sm" className="h-7 text-xs text-white" style={{ background: BRAND }}
                      disabled={assign.isPending}
                      onClick={() => assign.mutate({ courseId: s.courseId!, traineeCodes: [s.traineeCode], reason: s.reason })}>
                      Assign
                    </Button>
                  </>
                ) : (
                  <select className="border rounded-md px-2 py-1 text-xs bg-background" defaultValue=""
                    onChange={e => { if (e.target.value) assign.mutate({ courseId: Number(e.target.value), traineeCodes: [s.traineeCode], reason: s.reason }); }}>
                    <option value="">Pick a course…</option>
                    {(courses as Course[]).filter(c => c.isPublished).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
