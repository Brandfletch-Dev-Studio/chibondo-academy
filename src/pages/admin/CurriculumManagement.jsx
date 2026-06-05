import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Plus, Edit2, Trash2, GraduationCap, BookOpen, Layers,
  BookMarked, Loader2, Users, ChevronRight, Eye, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

// ─── COURSE (SUBJECT) MANAGER ────────────────────────────────────────────────
function CourseManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterForm, setFilterForm] = useState('all');
  const empty = { name: '', description: '', form_id: '', teacher_id: '', is_premium: true, status: 'draft', order: 0 };
  const [formData, setFormData] = useState(empty);

  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: () => base44.entities.AcademicForm.list('order', 50) });
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }, 'full_name', 100) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.Enrollment.filter({}) });

  const saveMutation = useMutation({
    mutationFn: () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const data = { ...formData, form_name: selectedForm?.name || '', teacher_name: selectedTeacher?.full_name || '' };
      return editing ? base44.entities.Subject.update(editing.id, data) : base44.entities.Subject.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); closeDialog(); toast.success(editing ? 'Course updated' : 'Course created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Course deleted'); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Subject.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allSubjects'] }),
  });

  const openEdit = (s) => { setEditing(s); setFormData(s); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setFormData(empty); };
  const filteredSubjects = filterForm === 'all' ? subjects : subjects.filter(s => s.form_id === filterForm);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Courses by Form</h3>
        <div className="flex gap-2">
          <Select value={filterForm} onValueChange={setFilterForm}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Forms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Course</Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No forms found. Create forms in Academic Settings first.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {forms.map(f => {
            const formSubjects = filteredSubjects.filter(s => s.form_id === f.id);
            if (filterForm !== 'all' && f.id !== filterForm) return null;
            return (
              <AccordionItem key={f.id} value={f.id} className="border border-border rounded-xl overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{f.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{formSubjects.length} courses</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 mt-2">
                    {formSubjects.map(s => {
                      const enrolled = enrollments.filter(e => e.subject_id === s.id).length;
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background">
                          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.teacher_name || 'No tutor assigned'} · {s.total_lessons || 0} lessons · {enrolled} students
                            </p>
                          </div>
                          <Badge className={`text-[9px] ${s.is_premium ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'}`}>
                            {s.is_premium ? 'Premium' : 'Free'}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{s.status}</span>
                            <Switch
                              checked={s.status === 'published'}
                              onCheckedChange={(v) => toggleStatusMutation.mutate({ id: s.id, status: v ? 'published' : 'draft' })}
                              className="scale-75"
                            />
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Edit2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                    {formSubjects.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No courses in {f.name}</p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-1 text-xs border border-dashed border-border"
                      onClick={() => { setFormData({ ...empty, form_id: f.id }); setOpen(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Add course to {f.name}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Course' : 'Create New Course'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Course Name</Label><Input className="mt-1" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Course overview..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Form / Class Level</Label>
                <Select value={formData.form_id || ''} onValueChange={v => setFormData({ ...formData, form_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Assign Tutor</Label>
                <Select value={formData.teacher_id || 'none'} onValueChange={v => setFormData({ ...formData, teacher_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No tutor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tutor assigned</SelectItem>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Display Order</Label><Input type="number" className="mt-1" value={formData.order || 0} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium">Premium Course</p>
                <p className="text-xs text-muted-foreground">Requires paid fees to access</p>
              </div>
              <Switch checked={formData.is_premium !== false} onCheckedChange={v => setFormData({ ...formData, is_premium: v })} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.name || !formData.form_id}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editing ? 'Save Changes' : 'Create Course'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TUTOR ALLOCATION ────────────────────────────────────────────────────────
function TutorAllocation() {
  const queryClient = useQueryClient();
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }, 'full_name', 100) });
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.Enrollment.filter({}) });

  const reassignMutation = useMutation({
    mutationFn: ({ subjectId, teacherId, teacherName }) =>
      base44.entities.Subject.update(subjectId, { teacher_id: teacherId, teacher_name: teacherName }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Tutor reassigned'); },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Assign or reassign tutors to courses. Each course can have one primary tutor.</p>

      {teachers.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No tutors found. Approve teacher applications first.
        </div>
      )}

      {teachers.map(teacher => {
        const assignedCourses = subjects.filter(s => s.teacher_id === teacher.id);
        const totalStudents = assignedCourses.reduce((sum, s) => sum + enrollments.filter(e => e.subject_id === s.id).length, 0);
        return (
          <div key={teacher.id} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="flex items-center gap-4 p-4 bg-muted/20">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                {teacher.full_name?.[0]?.toUpperCase() || 'T'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{teacher.full_name}</p>
                <p className="text-xs text-muted-foreground">{teacher.email} · {assignedCourses.length} courses · {totalStudents} students</p>
              </div>
              <Badge className="bg-success/10 text-success text-[10px]">Active Tutor</Badge>
            </div>
            {assignedCourses.length > 0 && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assignedCourses.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 text-sm">
                    <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.form_name}</span>
                  </div>
                ))}
              </div>
            )}
            {assignedCourses.length === 0 && (
              <div className="px-4 pb-4 pt-2 text-xs text-muted-foreground">No courses assigned yet.</div>
            )}
          </div>
        );
      })}

      <div className="mt-4">
        <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Unassigned Courses</h4>
        <div className="space-y-2">
          {subjects.filter(s => !s.teacher_id).map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.form_name}</p>
              </div>
              <Select onValueChange={v => {
                const t = teachers.find(t => t.id === v);
                reassignMutation.mutate({ subjectId: s.id, teacherId: v, teacherName: t?.full_name || '' });
              }}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign tutor" /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          {subjects.filter(s => !s.teacher_id).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">All courses have tutors assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ENROLLED STUDENTS PER COURSE ────────────────────────────────────────────
function CourseEnrollments() {
  const [selectedSubject, setSelectedSubject] = useState('');
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.Enrollment.filter({}) });
  const { data: students = [] } = useQuery({ queryKey: ['allStudents'], queryFn: () => base44.entities.StudentProfile.filter({}) });
  const { data: users = [] } = useQuery({ queryKey: ['allUsers'], queryFn: () => base44.entities.User.filter({ role: 'user' }) });

  const courseEnrollments = selectedSubject
    ? enrollments.filter(e => e.subject_id === selectedSubject)
    : [];

  const getStudentName = (studentId) => {
    const sp = students.find(s => s.user_id === studentId);
    if (sp?.full_name) return sp.full_name;
    const u = users.find(u => u.id === studentId);
    return u?.full_name || 'Unknown Student';
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Course to View Enrollments</Label>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="mt-1 max-w-sm"><SelectValue placeholder="Choose a course..." /></SelectTrigger>
          <SelectContent>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedSubject && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{courseEnrollments.length} Enrolled Students</span>
          </div>
          {courseEnrollments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No students enrolled in this course yet.
            </div>
          ) : (
            <div className="space-y-2">
              {courseEnrollments.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {getStudentName(e.student_id)?.[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getStudentName(e.student_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.completed_lessons?.length || 0} lessons completed ·
                      Last active {e.last_accessed ? new Date(e.last_accessed).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{e.progress_percentage || 0}%</p>
                    <Badge className={`text-[9px] ${e.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{e.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CurriculumManagement() {
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }) });
  const { data: enrollments = [] } = useQuery({ queryKey: ['allEnrollments'], queryFn: () => base44.entities.Enrollment.filter({}) });
  const { data: lessons = [] } = useQuery({ queryKey: ['allLessons'], queryFn: () => base44.entities.Lesson.filter({}) });

  const stats = [
    { label: 'Total Courses', value: subjects.length, icon: BookOpen, color: 'text-primary bg-primary/10' },
    { label: 'Active Tutors', value: teachers.length, icon: UserCheck, color: 'text-accent bg-accent/10' },
    { label: 'Total Lessons', value: lessons.length, icon: BookMarked, color: 'text-success bg-success/10' },
    { label: 'Enrollments', value: enrollments.length, icon: Users, color: 'text-destructive bg-destructive/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Curriculum Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Create and manage courses, assign tutors, and track student enrollment</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold font-display">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="courses"><BookOpen className="w-4 h-4 mr-1.5" /> Courses</TabsTrigger>
          <TabsTrigger value="tutors"><UserCheck className="w-4 h-4 mr-1.5" /> Tutor Allocation</TabsTrigger>
          <TabsTrigger value="enrollments"><Users className="w-4 h-4 mr-1.5" /> Enrollments</TabsTrigger>
        </TabsList>
        <TabsContent value="courses" className="mt-5"><CourseManager /></TabsContent>
        <TabsContent value="tutors" className="mt-5"><TutorAllocation /></TabsContent>
        <TabsContent value="enrollments" className="mt-5"><CourseEnrollments /></TabsContent>
      </Tabs>
    </div>
  );
}