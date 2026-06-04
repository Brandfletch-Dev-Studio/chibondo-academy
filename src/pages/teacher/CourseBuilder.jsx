import React, { useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit2, Trash2, PlayCircle, Layers, FileText, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

function TopicForm({ subjectId, formId, topic, onClose }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState(topic || { title: '', description: '', order: 0 });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (topic) {
        await base44.entities.Topic.update(topic.id, data);
      } else {
        await base44.entities.Topic.create({ ...data, subject_id: subjectId, form_id: formId, status: 'published' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success(topic ? 'Topic updated' : 'Topic created');
      onClose();
    },
  });

  return (
    <div className="space-y-4">
      <div><Label>Title</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} placeholder="e.g. Trigonometry" /></div>
      <div><Label>Description</Label><Textarea value={data.description || ''} onChange={e => setData({ ...data, description: e.target.value })} /></div>
      <div><Label>Order</Label><Input type="number" value={data.order} onChange={e => setData({ ...data, order: parseInt(e.target.value) || 0 })} /></div>
      <Button onClick={() => saveMutation.mutate()} className="w-full">{topic ? 'Update Topic' : 'Add Topic'}</Button>
    </div>
  );
}

function LessonForm({ topicId, subjectId, subjectName, topicTitle, formId, lesson, onClose }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState(lesson || { 
    title: '', description: '', content: '', video_url: '', 
    video_provider: 'none', order: 0, status: 'draft', is_free: false, estimated_minutes: 15 
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...data, topic_id: topicId, subject_id: subjectId, subject_name: subjectName, topic_title: topicTitle, form_id: formId };
      if (lesson) {
        await base44.entities.Lesson.update(lesson.id, payload);
      } else {
        await base44.entities.Lesson.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success(lesson ? 'Lesson updated' : 'Lesson created');
      onClose();
    },
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div><Label>Title</Label><Input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} placeholder="Lesson title" /></div>
      <div><Label>Description</Label><Textarea value={data.description || ''} onChange={e => setData({ ...data, description: e.target.value })} /></div>
      <div><Label>Lesson Notes (HTML)</Label><Textarea value={data.content || ''} onChange={e => setData({ ...data, content: e.target.value })} className="min-h-[120px] font-mono text-xs" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Video Provider</Label>
          <Select value={data.video_provider} onValueChange={v => setData({ ...data, video_provider: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Video</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="bunny">Bunny.net</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Video URL</Label><Input value={data.video_url || ''} onChange={e => setData({ ...data, video_url: e.target.value })} placeholder="Video URL" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Duration (min)</Label><Input type="number" value={data.estimated_minutes} onChange={e => setData({ ...data, estimated_minutes: parseInt(e.target.value) || 0 })} /></div>
        <div><Label>Order</Label><Input type="number" value={data.order} onChange={e => setData({ ...data, order: parseInt(e.target.value) || 0 })} /></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={data.is_free} onCheckedChange={v => setData({ ...data, is_free: v })} />
          <Label>Free preview</Label>
        </div>
        <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => saveMutation.mutate()} className="w-full">{lesson ? 'Update Lesson' : 'Add Lesson'}</Button>
    </div>
  );
}

export default function CourseBuilder() {
  const { subjectId } = useParams();
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [topicDialog, setTopicDialog] = useState({ open: false, topic: null });
  const [lessonDialog, setLessonDialog] = useState({ open: false, lesson: null, topicId: null, topicTitle: '' });

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => { const r = await base44.entities.Subject.filter({ id: subjectId }); return r[0]; },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => base44.entities.Topic.filter({ subject_id: subjectId }, 'order', 100),
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons', subjectId],
    queryFn: () => base44.entities.Lesson.filter({ subject_id: subjectId }, 'order', 200),
  });

  const deleteTopic = useMutation({
    mutationFn: (id) => base44.entities.Topic.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['topics'] }); toast.success('Topic deleted'); },
  });

  const deleteLesson = useMutation({
    mutationFn: (id) => base44.entities.Lesson.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lessons'] }); toast.success('Lesson deleted'); },
  });

  const lessonsByTopic = {};
  lessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });

  if (!subject) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/teacher/courses"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div>
          <h1 className="text-xl font-display font-bold">{subject.name}</h1>
          <p className="text-sm text-muted-foreground">{subject.form_name} · Course Builder</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{topics.length} topics · {lessons.length} lessons</p>
        <Dialog open={topicDialog.open} onOpenChange={v => setTopicDialog({ open: v, topic: null })}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Topic</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{topicDialog.topic ? 'Edit Topic' : 'New Topic'}</DialogTitle></DialogHeader>
            <TopicForm subjectId={subjectId} formId={subject.form_id} topic={topicDialog.topic} onClose={() => setTopicDialog({ open: false, topic: null })} />
          </DialogContent>
        </Dialog>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {topics.map((topic, idx) => {
          const topicLessons = lessonsByTopic[topic.id] || [];
          return (
            <AccordionItem key={topic.id} value={topic.id} className="border border-border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                  <div className="text-left">
                    <p className="font-medium text-sm">{topic.title}</p>
                    <p className="text-xs text-muted-foreground">{topicLessons.length} lessons</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={() => setLessonDialog({ open: true, lesson: null, topicId: topic.id, topicTitle: topic.title })}>
                    <Plus className="w-3 h-3 mr-1" /> Add Lesson
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTopicDialog({ open: true, topic })}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTopic.mutate(topic.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
                <div className="space-y-1">
                  {topicLessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 group">
                      <PlayCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm flex-1">{lesson.title}</span>
                      {lesson.is_free && <Badge variant="secondary" className="text-[9px]">Free</Badge>}
                      <Badge variant="secondary" className="text-[9px]">{lesson.status}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setLessonDialog({ open: true, lesson, topicId: topic.id, topicTitle: topic.title })}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteLesson.mutate(lesson.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {topics.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-16 h-16 mx-auto opacity-20 mb-4" />
          <p>Start by adding your first topic</p>
        </div>
      )}

      {/* Lesson Dialog */}
      <Dialog open={lessonDialog.open} onOpenChange={v => setLessonDialog({ ...lessonDialog, open: v })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{lessonDialog.lesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle></DialogHeader>
          <LessonForm 
            topicId={lessonDialog.topicId}
            topicTitle={lessonDialog.topicTitle}
            subjectId={subjectId}
            subjectName={subject.name}
            formId={subject.form_id}
            lesson={lessonDialog.lesson}
            onClose={() => setLessonDialog({ open: false, lesson: null, topicId: null, topicTitle: '' })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}