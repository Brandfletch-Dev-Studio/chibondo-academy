import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, GraduationCap, BookOpen, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';

function FormManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', order: 0 });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => base44.entities.AcademicForm.list('order', 50),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await base44.entities.AcademicForm.update(editing.id, form);
      } else {
        await base44.entities.AcademicForm.create({ ...form, status: 'active' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setOpen(false);
      setEditing(null);
      setForm({ name: '', description: '', order: 0 });
      toast.success(editing ? 'Form updated' : 'Form created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AcademicForm.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Academic Forms</h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: '', description: '', order: 0 }); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Form' : 'New Form'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Form 3" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
              </div>
              <Button onClick={() => saveMutation.mutate()} className="w-full">{editing ? 'Update' : 'Create'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {forms.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <GraduationCap className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">{f.status}</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(f); setForm(f); setOpen(true); }}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {forms.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No forms created yet</p>}
      </div>
    </div>
  );
}

function SubjectManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', form_id: '', is_premium: true, status: 'draft' });

  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: () => base44.entities.AcademicForm.list('order', 50) });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => base44.entities.Subject.list('order', 200) });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.User.filter({ role: 'teacher' }, 'full_name', 100) });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const data = {
        ...formData,
        form_name: selectedForm?.name || '',
        teacher_name: selectedTeacher?.full_name || '',
      };
      if (editing) {
        await base44.entities.Subject.update(editing.id, data);
      } else {
        await base44.entities.Subject.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setOpen(false); setEditing(null);
      setFormData({ name: '', description: '', form_id: '', is_premium: true, status: 'draft' });
      toast.success(editing ? 'Subject updated' : 'Subject created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Subject deleted'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Subjects</h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setFormData({ name: '', description: '', form_id: '', is_premium: true, status: 'draft' }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Subject</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit Subject' : 'New Subject'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mathematics" /></div>
              <div><Label>Description</Label><Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><Label>Form</Label>
                <Select value={formData.form_id} onValueChange={v => setFormData({ ...formData, form_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Teacher</Label>
                <Select value={formData.teacher_id || ''} onValueChange={v => setFormData({ ...formData, teacher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveMutation.mutate()} className="w-full">{editing ? 'Update' : 'Create'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {subjects.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <BookOpen className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.form_name} · {s.teacher_name || 'No teacher'}</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(s); setFormData(s); setOpen(true); }}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {subjects.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No subjects yet</p>}
      </div>
    </div>
  );
}

export default function AcademicManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Academic Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage forms, subjects, topics, and lessons</p>
      </div>
      <Tabs defaultValue="forms">
        <TabsList>
          <TabsTrigger value="forms"><GraduationCap className="w-4 h-4 mr-1" /> Forms</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 mr-1" /> Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="forms" className="mt-4"><FormManager /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectManager /></TabsContent>
      </Tabs>
    </div>
  );
}