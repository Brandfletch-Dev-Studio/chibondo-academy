import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, FileText, Plus, Search, Upload, Trash2, Edit2,
  X, Download, Star, Lock, Globe, Loader2, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import BulkUploadDialog from '@/components/library/BulkUploadDialog';

const TYPE_META = {
  past_paper:     { label: 'Past Paper',     color: 'bg-blue-500/10 text-blue-600' },
  model_answer:   { label: 'Model Answer',   color: 'bg-green-500/10 text-green-600' },
  revision_notes: { label: 'Rev. Notes',     color: 'bg-purple-500/10 text-purple-600' },
  exam_tips:      { label: 'Exam Tips',      color: 'bg-orange-500/10 text-orange-600' },
  mock_exam:      { label: 'Mock Exam',      color: 'bg-red-500/10 text-red-600' },
};

const TABS = ['all', 'past_paper', 'model_answer', 'revision_notes', 'exam_tips', 'mock_exam'];

// ── Resource Form ─────────────────────────────────────────────────────────────
function ResourceForm({ resource, subjects, forms, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    title: resource?.title || '',
    description: resource?.description || '',
    type: resource?.type || 'past_paper',
    subject_id: resource?.subject_id || '',
    form_id: resource?.form_id || '',
    year: resource?.year || new Date().getFullYear(),
    is_premium: resource?.is_premium ?? true,
  });
  const [file, setFile] = useState(resource?.file_url ? { name: 'Current file', url: resource.file_url } : null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('Max file size is 10MB'); return; }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setFile({ name: f.name, url: file_url });
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!form.title || !form.subject_id || !form.form_id) { toast.error('Fill in all required fields'); return; }
    const subject = subjects.find(s => s.id === form.subject_id);
    const academic = forms.find(f => f.id === form.form_id);
    onSave({
      ...form,
      file_url: file?.url || null,
      subject_name: subject?.name || '',
      form_name: academic?.name || '',
      status: 'published',
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">{resource ? 'Edit Resource' : 'Add New Resource'}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">Title *</Label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="e.g., 2024 Mathematics Paper 1" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">Description</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Brief description" />
        </div>

        <div>
          <Label className="text-xs font-medium">Type *</Label>
          <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium">Year</Label>
          <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-medium">Subject *</Label>
          <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
            <option value="">Select subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium">Form *</Label>
          <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.form_id} onChange={e => setForm(f => ({ ...f, form_id: e.target.value }))}>
            <option value="">Select form</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* File upload */}
        <div className="sm:col-span-2">
          <Label className="text-xs font-medium">File (PDF / Word, max 10MB)</Label>
          {file ? (
            <div className="mt-1 flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
              <FileText className="w-5 h-5 text-accent flex-shrink-0" />
              <span className="text-sm flex-1 truncate">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="mt-1 flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors text-center">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground">{uploading ? 'Uploading…' : 'Click to upload'}</span>
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Premium toggle */}
        <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_premium: !f.is_premium }))}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.is_premium ? 'bg-accent' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_premium ? 'translate-x-5' : ''}`} />
          </button>
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              {form.is_premium ? <Lock className="w-3.5 h-3.5 text-accent" /> : <Globe className="w-3.5 h-3.5" />}
              {form.is_premium ? 'Subscribers Only' : 'Free for All'}
            </p>
            <p className="text-xs text-muted-foreground">{form.is_premium ? 'Only paid students can access' : 'All students can access'}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSaving || uploading} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {resource ? 'Update Resource' : 'Add Resource'}
        </Button>
      </div>
    </div>
  );
}

// ── Resource Row ──────────────────────────────────────────────────────────────
function ResourceRow({ resource, onEdit, onDelete }) {
  const meta = TYPE_META[resource.type] || TYPE_META.past_paper;
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{resource.title}</span>
          <Badge className={`text-[9px] border-0 px-1.5 ${meta.color}`}>{meta.label}</Badge>
          {resource.is_premium && <Badge className="text-[9px] bg-accent/10 text-accent-foreground border-0 px-1.5"><Lock className="w-2.5 h-2.5 inline mr-0.5" />Premium</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {resource.subject_name} · {resource.form_name}{resource.year ? ` · ${resource.year}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {resource.file_url && (
          <button onClick={() => window.open(resource.file_url, '_blank')} title="Download" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
            <Download className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onEdit(resource)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => { if (confirm('Delete this resource?')) onDelete(resource.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LibraryManagement() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: resources = [] } = useQuery({
    queryKey: ['libraryResources'],
    queryFn: () => base44.entities.RevisionResource.list('-created_date', 200),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['allSubjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }),
  });
  const { data: forms = [] } = useQuery({
    queryKey: ['academicForms'],
    queryFn: () => base44.entities.AcademicForm.filter({ status: 'active' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RevisionResource.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['libraryResources'] }); setShowForm(false); toast.success('Resource added!'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RevisionResource.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['libraryResources'] }); setEditingResource(null); setShowForm(false); toast.success('Updated!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RevisionResource.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['libraryResources'] }); toast.success('Deleted'); },
  });

  const handleEdit = (r) => { setEditingResource(r); setShowForm(true); };
  const handleCancel = () => { setEditingResource(null); setShowForm(false); };
  const handleSave = (data) => {
    if (editingResource) updateMutation.mutate({ id: editingResource.id, data });
    else createMutation.mutate(data);
  };

  const displayed = resources
    .filter(r => activeTab === 'all' || r.type === activeTab)
    .filter(r => !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.subject_name?.toLowerCase().includes(search.toLowerCase()));

  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === 'all' ? resources.length : resources.filter(r => r.type === t).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" /> Library Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{resources.length} resources across all subjects</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <BulkUploadDialog subjects={subjects} forms={forms} onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['libraryResources'] })} />
          <Button onClick={() => { setEditingResource(null); setShowForm(true); }} disabled={showForm && !editingResource}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Resource
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {TABS.map(t => {
          const meta = t === 'all' ? { label: 'All', color: 'bg-muted text-foreground' } : TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`p-3 rounded-xl border text-left transition-all ${activeTab === t ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/20'}`}
            >
              <p className="text-xl font-bold font-display">{counts[t]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* Form (inline, not dialog) */}
      {showForm && (
        <ResourceForm
          resource={editingResource}
          subjects={subjects}
          forms={forms}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by title or subject…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <span className="text-sm text-muted-foreground flex-shrink-0">{displayed.length} results</span>
        </div>

        {displayed.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No resources found</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {displayed.map(r => (
              <ResourceRow key={r.id} resource={r} onEdit={handleEdit} onDelete={deleteMutation.mutate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}