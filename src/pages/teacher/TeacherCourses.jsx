import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Settings, Plus, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const STATUS_STYLE = {
  published:  'bg-success/10 text-success',
  draft:      'bg-muted text-muted-foreground',
  pending:    'bg-yellow-500/10 text-yellow-600',
  archived:   'bg-destructive/10 text-destructive',
};

const STATUS_ICON = {
  published:  CheckCircle2,
  pending:    Clock,
  archived:   XCircle,
  draft:      Clock,
};

export default function TeacherCourses() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { name: '', description: '', form_id: '', is_premium: true, order: 0 };
  const [formData, setFormData] = useState(empty);

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacherSubjects', user?.id],
    queryFn: () => base44.entities.Subject.filter({ teacher_id: user.id }, 'order', 100),
    enabled: !!user?.id,
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => base44.entities.AcademicForm.list('order', 50),
  });

  // Also load courses teacher proposed (status = 'pending_approval' stored as draft with a flag)
  // We flag teacher-created pending courses with status='draft' and no admin assignment — admin approves by publishing
  const pendingCourses = subjects.filter(s => s.status === 'draft' && s.pending_approval);
  const activeCourses = subjects.filter(s => !s.pending_approval || s.status === 'published');

  const createCourseMutation = useMutation({
    mutationFn: () => {
      const selectedForm = forms.find(f => f.id === formData.form_id);
      return base44.entities.Subject.create({
        ...formData,
        teacher_id: user.id,
        teacher_name: user.full_name,
        form_name: selectedForm?.name || '',
        status: 'draft',
        pending_approval: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherSubjects'] });
      setOpen(false);
      setFormData(empty);
      toast.success('Course submitted for admin approval');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">My Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your assigned and created courses</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Propose Course
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active <Badge className="ml-1.5 text-[10px] bg-primary/10 text-primary border-0">{activeCourses.length}</Badge></TabsTrigger>
          <TabsTrigger value="pending">Pending Approval <Badge className="ml-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 border-0">{pendingCourses.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCourses.map(s => {
              const Icon = STATUS_ICON[s.status] || Clock;
              return (
                <div key={s.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <Badge className={`text-[10px] ${STATUS_STYLE[s.status] || ''}`}>{s.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.form_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.total_topics || 0} topics · {s.total_lessons || 0} lessons</p>
                  <div className="mt-4">
                    <Link to={`/teacher/courses/${s.id}`}>
                      <Button size="sm" className="w-full"><Settings className="w-3.5 h-3.5 mr-1" /> Course Builder</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
            {activeCourses.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-medium">No courses assigned yet</p>
                <p className="text-xs mt-1">Propose a new course or wait for admin to assign one</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Propose a Course
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <div className="space-y-3">
            {pendingCourses.map(s => (
              <div key={s.id} className="bg-card border border-yellow-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.form_name} · Submitted {new Date(s.created_date).toLocaleDateString()}</p>
                </div>
                <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">Awaiting Approval</Badge>
              </div>
            ))}
            {pendingCourses.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                No pending proposals
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Propose Course Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setFormData(empty); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose a New Course</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Your proposal will be reviewed by an admin before it goes live.</p>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Course Name</Label>
              <Input className="mt-1" value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={2} value={formData.description || ''} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} placeholder="What will students learn?" />
            </div>
            <div>
              <Label>Form / Class Level</Label>
              <Select value={formData.form_id} onValueChange={v => setFormData(d => ({ ...d, form_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select form" /></SelectTrigger>
                <SelectContent>
                  {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setFormData(empty); }}>Cancel</Button>
              <Button className="flex-1" onClick={() => createCourseMutation.mutate()} disabled={createCourseMutation.isPending || !formData.name || !formData.form_id}>
                {createCourseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Submit Proposal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}