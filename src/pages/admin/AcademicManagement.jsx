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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit2, Trash2, GraduationCap, BookOpen, Layers, ChevronRight, BookMarked, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ---------- FORM MANAGER ----------
function FormManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name: '', description: '', order: 0, status: 'active' };
  const [form, setForm] = useState(empty);

  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: () => base44.entities.AcademicForm.list('order', 50) });
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });

  const saveMutation = useMutation({
    mutationFn: () => editing ? base44.entities.AcademicForm.update(editing.id, form) : base44.entities.AcademicForm.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); closeDialog(); toast.success(editing ? 'Form updated' : 'Form created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AcademicForm.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); toast.success('Form deleted'); },
  });

  const openEdit = (f) => { setEditing(f); setForm(f); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(empty); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Academic Forms / Classes</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Form</Button>
      </div>
      <div className="space-y-3">
        {forms.map(f => {
          const subjectCount = subjects.filter(s => s.form_id === f.id).length;
          return (
            <div key={f.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.description || 'No description'} · {subjectCount} subject{subjectCount !== 1 ? 's' : ''}</p>
              </div>
              <Badge variant="secondary" className={`text-[10px] ${f.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {f.status}
              </Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          );
        })}
        {forms.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">No forms yet. Click "Add Form" to create one.</div>}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Form' : 'New Academic Form'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Form Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Form 3" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Display Order</Label><Input type="number" className="mt-1" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editing ? 'Save Changes' : 'Create Form'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- SUBJECT MANAGER ----------
function SubjectManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterForm, setFilterForm] = useState('all');
  const empty = { name: '', description: '', form_id: '', teacher_id: '', is_premium: true, status: 'draft', order: 0 };
  const [formData, setFormData] = useState(empty);

  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: () => base44.entities.AcademicForm.list('order', 50) });
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }, 'full_name', 100) });
  const { data: topics = [] } = useQuery({ queryKey: ['allTopics'], queryFn: () => base44.entities.Topic.list('order', 500) });

  const saveMutation = useMutation({
    mutationFn: () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const data = { ...formData, form_name: selectedForm?.name || '', teacher_name: selectedTeacher?.full_name || '' };
      return editing ? base44.entities.Subject.update(editing.id, data) : base44.entities.Subject.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); closeDialog(); toast.success(editing ? 'Subject updated' : 'Subject created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); toast.success('Subject deleted'); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Subject.update(id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allSubjects'] }); },
  });

  const openEdit = (s) => { setEditing(s); setFormData(s); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setFormData(empty); };

  const filteredSubjects = filterForm === 'all' ? subjects : subjects.filter(s => s.form_id === filterForm);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Subjects</h3>
        <div className="flex gap-2">
          <Select value={filterForm} onValueChange={setFilterForm}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Forms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Subject</Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Create academic forms first before adding subjects.
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
                    <Badge variant="secondary" className="text-[10px]">{formSubjects.length} subjects</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 mt-2">
                    {formSubjects.map(s => {
                      const topicCount = topics.filter(t => t.subject_id === s.id).length;
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background">
                          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.teacher_name || 'No teacher'} · {topicCount} topics · {s.total_lessons || 0} lessons</p>
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
                      <p className="text-xs text-muted-foreground text-center py-3">No subjects in {f.name}</p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-1 text-xs border border-dashed border-border" onClick={() => { setFormData({ ...empty, form_id: f.id }); setOpen(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Add subject to {f.name}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      {filteredSubjects.length === 0 && forms.length > 0 && filterForm === 'all' && (
        <div className="text-center py-6 text-sm text-muted-foreground">No subjects yet. Click "Add Subject" to create one.</div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Subject' : 'New Subject'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Subject Name</Label><Input className="mt-1" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Form / Class</Label>
                <Select value={formData.form_id || ''} onValueChange={v => setFormData({ ...formData, form_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Assign Teacher</Label>
                <Select value={formData.teacher_id || ''} onValueChange={v => setFormData({ ...formData, teacher_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No teacher" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No teacher</SelectItem>
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
                <p className="text-sm font-medium">Premium Subject</p>
                <p className="text-xs text-muted-foreground">Requires paid fees to access</p>
              </div>
              <Switch checked={formData.is_premium !== false} onCheckedChange={v => setFormData({ ...formData, is_premium: v })} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.name || !formData.form_id}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editing ? 'Save Changes' : 'Create Subject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- TOPIC MANAGER ----------
function TopicManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterSubject, setFilterSubject] = useState('all');
  const empty = { title: '', description: '', subject_id: '', form_id: '', order: 0, status: 'draft' };
  const [formData, setFormData] = useState(empty);

  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: topics = [] } = useQuery({ queryKey: ['allTopics'], queryFn: () => base44.entities.Topic.list('order', 500) });
  const { data: lessons = [] } = useQuery({ queryKey: ['allLessons'], queryFn: () => base44.entities.Lesson.list('order', 1000) });

  const saveMutation = useMutation({
    mutationFn: () => {
      const sub = subjects.find(s => s.id === formData.subject_id);
      const data = { ...formData, subject_name: sub?.name || '', form_id: sub?.form_id || '' };
      return editing ? base44.entities.Topic.update(editing.id, data) : base44.entities.Topic.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allTopics'] }); closeDialog(); toast.success(editing ? 'Topic updated' : 'Topic created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Topic.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['allTopics'] }); toast.success('Topic deleted'); },
  });

  const openEdit = (t) => { setEditing(t); setFormData(t); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setFormData(empty); };

  const filteredTopics = filterSubject === 'all' ? topics : topics.filter(t => t.subject_id === filterSubject);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-base">Topics</h3>
        <div className="flex gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Topic</Button>
        </div>
      </div>
      <div className="space-y-2">
        {filteredTopics.map(t => {
          const lessonCount = lessons.filter(l => l.topic_id === t.id).length;
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <Layers className="w-4 h-4 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.subject_name} · {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</p>
              </div>
              <Badge className={`text-[9px] ${t.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{t.status}</Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          );
        })}
        {filteredTopics.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">No topics found.</div>}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Topic' : 'New Topic'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Topic Title</Label><Input className="mt-1" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Algebra Basics" /></div>
            <div><Label>Description</Label><Textarea className="mt-1" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Subject</Label>
                <Select value={formData.subject_id || ''} onValueChange={v => setFormData({ ...formData, subject_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.form_name})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Order</Label><Input type="number" className="mt-1" value={formData.order || 0} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.title || !formData.subject_id}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editing ? 'Save Changes' : 'Create Topic'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- MAIN PAGE ----------
export default function AcademicManagement() {
  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: () => base44.entities.AcademicForm.list('order', 50) });
  const { data: subjects = [] } = useQuery({ queryKey: ['allSubjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: topics = [] } = useQuery({ queryKey: ['allTopics'], queryFn: () => base44.entities.Topic.list('order', 500) });
  const { data: lessons = [] } = useQuery({ queryKey: ['allLessons'], queryFn: () => base44.entities.Lesson.list('order', 1000) });

  const stats = [
    { label: 'Forms', value: forms.length, icon: GraduationCap, color: 'text-primary bg-primary/10' },
    { label: 'Subjects', value: subjects.length, icon: BookOpen, color: 'text-accent bg-accent/10' },
    { label: 'Topics', value: topics.length, icon: Layers, color: 'text-success bg-success/10' },
    { label: 'Lessons', value: lessons.length, icon: BookMarked, color: 'text-destructive bg-destructive/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Academic Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage forms, subjects, topics and curriculum</p>
      </div>

      {/* Stats */}
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

      <Tabs defaultValue="forms">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="forms"><GraduationCap className="w-4 h-4 mr-1.5" /> Forms</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 mr-1.5" /> Subjects</TabsTrigger>
          <TabsTrigger value="topics"><Layers className="w-4 h-4 mr-1.5" /> Topics</TabsTrigger>
        </TabsList>
        <TabsContent value="forms" className="mt-5"><FormManager /></TabsContent>
        <TabsContent value="subjects" className="mt-5"><SubjectManager /></TabsContent>
        <TabsContent value="topics" className="mt-5"><TopicManager /></TabsContent>
      </Tabs>
    </div>
  );
}