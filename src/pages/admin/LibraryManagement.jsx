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
  X, Download, Lock, Globe, Loader2, FolderOpen, Library,
  ChevronDown, MoreVertical, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import BulkUploadDialog from '@/components/library/BulkUploadDialog';
import { uploadImage } from '@/utils/uploadImage';

const TYPE_META = {
  book:       { label: 'Book',       color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  past_paper: { label: 'Past Paper', color: 'bg-primary/10 text-primary border-primary/20' },
  exam_tips:  { label: 'Exam Tips',  color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
};

const TYPE_KEYS = Object.keys(TYPE_META);
const TABS = ['all', ...TYPE_KEYS];

/* ── Resource Form ─────────────────────────────────────────────────────────── */
function ResourceForm({ resource, subjects, forms, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    title:       resource?.title       || '',
    description: resource?.description || '',
    type:        resource?.type        || 'past_paper',
    subject_id:  resource?.subject_id  || '',
    form_id:     resource?.form_id     || '',
    year:        resource?.year        || new Date().getFullYear(),
    is_premium:  resource?.is_premium  ?? true,
  });
  const [file, setFile]         = useState(resource?.file_url ? { name: 'Current file', url: resource.file_url } : null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error('Max file size is 20 MB'); return; }
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setFile({ name: f.name, url });
      toast.success('File uploaded successfully!');
    } catch (err) {
      toast.error(`Upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.title || !form.subject_id || !form.form_id) { toast.error('Fill in all required fields'); return; }
    const subject  = subjects.find(s => s.id === form.subject_id);
    const academic = forms.find(f => f.id === form.form_id);
    onSave({
      ...form,
      file_url:     file?.url || null,
      subject_name: subject?.name  || '',
      form_name:    academic?.name || '',
      status:       'published',
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-base">{resource ? 'Edit Resource' : 'Add New Resource'}</h3>
        <button onClick={onCancel} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</Label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="mt-1.5" placeholder="e.g. 2024 Mathematics Paper 1" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="mt-1.5" placeholder="Brief description" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type *</Label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {TYPE_KEYS.map(k => <option key={k} value={k}>{TYPE_META[k].label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Academic Form *</Label>
          <select value={form.form_id} onChange={e => setForm(f => ({ ...f, form_id: e.target.value }))}
            className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select form…</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject *</Label>
          <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
            className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select subject…</option>
            {subjects
              .filter(s => !form.form_id || s.form_id === form.form_id)
              .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year</Label>
          <Input type="number" value={form.year}
            onChange={e => setForm(f => ({ ...f, year: +e.target.value }))}
            className="mt-1.5" min="2000" max="2030" />
        </div>

        {/* File upload */}
        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">File (PDF / Doc)</Label>
          {file ? (
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40">
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm truncate min-w-0">{file.name}</span>
              <button onClick={() => setFile(null)}
                className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="mt-1.5 flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors bg-muted/20">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{uploading ? 'Uploading…' : 'Click to upload'}</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.txt" onChange={handleFile} />
            </label>
          )}
        </div>

        {/* Access toggle */}
        <div className="sm:col-span-2">
          <button type="button" onClick={() => setForm(f => ({ ...f, is_premium: !f.is_premium }))}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all ${form.is_premium ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/30'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${form.is_premium ? 'bg-accent/20' : 'bg-green-500/10'}`}>
              {form.is_premium ? <Lock className="w-4 h-4 text-accent" /> : <Globe className="w-4 h-4 text-green-500" />}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">{form.is_premium ? 'Premium Only' : 'Free Access'}</p>
              <p className="text-xs text-muted-foreground">{form.is_premium ? 'Requires active subscription' : 'Available to all students'}</p>
            </div>
            <div className={`ml-auto w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.is_premium ? 'bg-accent' : 'bg-muted'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform ${form.is_premium ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSaving || uploading} className="flex-1"
          style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}>
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : resource ? 'Save Changes' : 'Add Resource'}
        </Button>
      </div>
    </div>
  );
}

/* ── Resource Row ──────────────────────────────────────────────────────────── */
function ResourceRow({ resource, onEdit, onDelete }) {
  const meta = TYPE_META[resource.type] || { label: resource.type, color: 'bg-muted text-muted-foreground' };
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group border-b border-border/50 last:border-b-0">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0"
        style={{ background:'hsl(222 47% 18% / 0.08)' }}>
        <FileText className="w-4 h-4 text-primary" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug truncate">{resource.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[resource.subject_name, resource.form_name, resource.year].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Badges — hidden on small screens, shown on md+ */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
        {resource.is_premium
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground border border-accent/20 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />Premium</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-200 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />Free</span>
        }
      </div>

      {/* Actions — always visible, no overflow */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {resource.file_url && (
          <button
            onClick={() => window.open(resource.file_url, '_blank')}
            title="Download / Preview"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
            style={{ minWidth:'2rem' }}>
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onEdit(resource)}
          title="Edit"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ minWidth:'2rem' }}>
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { if (window.confirm(`Delete "${resource.title}"?`)) onDelete(resource.id); }}
          title="Delete"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
          style={{ minWidth:'2rem' }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function LibraryManagement() {
  const { user } = useOutletContext() ?? {};
  const qc       = useQueryClient();

  const [search,       setSearch]    = useState('');
  const [activeTab,    setActiveTab] = useState('all');
  const [formFilter,   setFormFilter]= useState('');
  const [editResource, setEdit]      = useState(null);
  const [showForm,     setShowForm]  = useState(false);
  const [showBulk,     setShowBulk]  = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['library-resources'],
    queryFn: () => base44.entities.RevisionResource.filter({}, '-created_date', 500),
    staleTime: 30_000,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 200),
    staleTime: 120_000,
  });
  const { data: forms = [] } = useQuery({
    queryKey: ['academic-forms'],
    queryFn: () => base44.entities.AcademicForm.filter({}, 'name', 10),
    staleTime: 300_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editResource
      ? base44.entities.RevisionResource.update(editResource.id, data)
      : base44.entities.RevisionResource.create(data),
    onSuccess: () => {
      toast.success(editResource ? 'Resource updated' : 'Resource added');
      qc.invalidateQueries({ queryKey: ['library-resources'] });
      setEdit(null);
      setShowForm(false);
    },
    onError: () => toast.error('Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RevisionResource.delete(id),
    onSuccess: () => {
      toast.success('Resource deleted');
      qc.invalidateQueries({ queryKey: ['library-resources'] });
    },
  });

  const handleEdit = (r) => { setEdit(r); setShowForm(true); window.scrollTo({ top: 0, behavior:'smooth' }); };
  const handleClose = () => { setEdit(null); setShowForm(false); };

  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.subject_name?.toLowerCase().includes(search.toLowerCase());
    const matchType   = activeTab === 'all' || r.type === activeTab;
    const matchForm   = !formFilter || r.form_id === formFilter;
    return matchSearch && matchType && matchForm;
  });

  const stats = {
    total:   resources.length,
    premium: resources.filter(r => r.is_premium).length,
    free:    resources.filter(r => !r.is_premium).length,
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl p-5" style={{ background:'hsl(222 47% 14%)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Library className="w-5 h-5" style={{ color:'hsl(43 74% 66%)' }} />
          <span className="text-sm font-medium" style={{ color:'hsl(43 74% 66% / 0.8)' }}>Admin</span>
        </div>
        <h1 className="text-xl font-display font-bold mb-1" style={{ color:'hsl(43 20% 94%)' }}>Library Management</h1>
        <div className="flex gap-5">
          {[{ label:'Total',   val:stats.total },{ label:'Premium', val:stats.premium },{ label:'Free', val:stats.free }].map(({ label,val }) => (
            <div key={label}>
              <p className="font-bold text-lg" style={{ color:'hsl(43 74% 66%)' }}>{val}</p>
              <p className="text-[11px]" style={{ color:'hsl(43 20% 65%)' }}>{label} resources</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search resources…" className="pl-9" />
        </div>
        <select value={formFilter} onChange={e => setFormFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All Forms</option>
          {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2">
          <Upload className="w-4 h-4" /> Bulk Upload
        </Button>
        <Button onClick={() => { setEdit(null); setShowForm(true); }} className="gap-2"
          style={{ background:'hsl(222 47% 18%)', color:'hsl(43 74% 66%)' }}>
          <Plus className="w-4 h-4" /> Add Resource
        </Button>
      </div>

      {/* ── Resource form (inline) ── */}
      {showForm && (
        <ResourceForm
          resource={editResource}
          subjects={subjects}
          forms={forms}
          onSave={saveMutation.mutate}
          onCancel={handleClose}
          isSaving={saveMutation.isPending}
        />
      )}

      {/* ── Type filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === tab
                ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
            style={activeTab === tab ? { background:'hsl(222 47% 18%)' } : {}}>
            {tab === 'all' ? `All (${resources.length})` : `${TYPE_META[tab].label} (${resources.filter(r=>r.type===tab).length})`}
          </button>
        ))}
      </div>

      {/* ── Resource list ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No resources found</p>
            <p className="text-xs text-muted-foreground/60">Try adjusting your filters or add a new resource</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{filtered.length} resource{filtered.length!==1?'s':''}</p>
            </div>
            {filtered.map(r => (
              <ResourceRow key={r.id} resource={r} onEdit={handleEdit} onDelete={deleteMutation.mutate} />
            ))}
          </>
        )}
      </div>

      {/* Bulk upload dialog */}
      {showBulk && (
        <BulkUploadDialog
          subjects={subjects}
          forms={forms}
          onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); qc.invalidateQueries({ queryKey: ['library-resources'] }); }}
        />
      )}
    </div>
  );
}
