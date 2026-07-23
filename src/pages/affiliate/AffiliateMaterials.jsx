import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Image, Download, ExternalLink, Video, MessageSquare, Plus, Trash2, Edit2, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

const TYPE_CONFIG = {
  banner:         { label: 'Banner',             icon: Image,          color: 'bg-blue-500/10 text-blue-600' },
  social_graphic: { label: 'Social Graphic',     icon: Image,          color: 'bg-purple-500/10 text-purple-600' },
  whatsapp_msg:   { label: 'WhatsApp Message',   icon: MessageSquare,  color: 'bg-green-500/10 text-green-600' },
  promo_image:    { label: 'Promo Image',        icon: Image,          color: 'bg-yellow-500/10 text-yellow-600' },
  video:          { label: 'Video',              icon: Video,          color: 'bg-red-500/10 text-red-600' },
  other:          { label: 'Other',              icon: Download,       color: 'bg-muted text-muted-foreground' },
};

function MaterialCard({ item, isAdmin, onEdit, onDelete }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
  const Icon = cfg.icon;
  const isText = item.type === 'whatsapp_msg';

  return (
    <SEO title="Marketing Materials" description="Download banners, social graphics, and WhatsApp messages to promote Chibondo Academy." />
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
      {/* Preview */}
      {item.thumbnail_url || item.file_url ? (
        <div className="aspect-video bg-muted/30 overflow-hidden">
          <img
            src={item.thumbnail_url || item.file_url}
            alt={item.title}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setLightboxUrl(item.thumbnail_url || item.file_url)}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
      ) : isText ? (
        <div className="p-4 bg-green-500/5 border-b border-border min-h-[80px]">
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">{item.content}</p>
        </div>
      ) : (
        <div className="aspect-video bg-muted/30 flex items-center justify-center">
          <Icon className="w-10 h-10 text-muted-foreground/30" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.title}</p>
            {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
          </div>
          <Badge className={`text-[10px] flex-shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
        </div>

        <div className="flex gap-2">
          {isText ? (
            <button
              onClick={() => { navigator.clipboard.writeText(item.content); toast.success('Copied!'); }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Copy Message
            </button>
          ) : item.file_url ? (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          ) : null}
          {isAdmin && (
            <>
              <button onClick={() => onEdit(item)} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(item.id)} className="p-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.95)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <img src={lightboxUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
              border: 'none', color: 'white', padding: 8, borderRadius: '50%', cursor: 'pointer'
            }}
          >
            <X style={{ width: 24, height: 24 }} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AffiliateMaterials() {
  const { user } = useOutletContext() || {};
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' });
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = React.useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error('File too large (max 50MB)');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading…');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `affiliate-materials/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const result = await db.storage.upload('assets', path, file);
      const fileUrl = result.file_url || result.publicURL || result.publicUrl;
      if (!fileUrl) throw new Error('Upload failed — no URL returned');

      setForm(f => {
        const isImage = ['png','jpg','jpeg','gif','webp','svg'].includes(ext);
        const isVideo = ['mp4','webm','mov','avi','mkv'].includes(ext);
        if (isImage) {
          return { ...f, file_url: fileUrl, thumbnail_url: f.thumbnail_url || fileUrl, type: f.type === 'banner' ? 'promo_image' : f.type };
        }
        if (isVideo) {
          return { ...f, file_url: fileUrl, type: f.type === 'banner' ? 'video' : f.type };
        }
        return { ...f, file_url: fileUrl };
      });
      setUploadProgress('Uploaded ✓');
      toast.success('File uploaded!');
    } catch (e) {
      setUploadProgress('');
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setForm(f => ({ ...f, file_url: '', thumbnail_url: '' }));
    setUploadProgress('');
  };

  const { data: materials = [], isLoading } = useQuery({queryKey: ['affiliateMaterials'],
    queryFn: async () => { try { return await db.entities.AffiliateMaterial.filter({}, '-created_date', 100); } catch(e) { console.error(e); return []; } },
    staleTime: 30_000,
    placeholderData: [],
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error('Title is required');
      if (form.type !== 'whatsapp_msg' && !form.file_url && !form.content) throw new Error('Please upload a file or paste a URL');
      if (form.type === 'whatsapp_msg' && !form.content) throw new Error('Message content is required for WhatsApp messages');
      if (editing) return db.entities.AffiliateMaterial.update(editing.id, form);
      return db.entities.AffiliateMaterial.create({ ...form, created_by_name: user.full_name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliateMaterials'] });
      toast.success(editing ? 'Updated!' : 'Material added!');
      setDialog(false); setEditing(null);
      setForm({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' });
    },
    onError: e => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: id => db.entities.AffiliateMaterial.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliateMaterials'] }); toast.success('Deleted'); },
  });

  const openEdit = (item) => {
    setEditing(item);
    setForm({ title: item.title, description: item.description || '', type: item.type, file_url: item.file_url || '', thumbnail_url: item.thumbnail_url || '', content: item.content || '' });
    setUploadProgress('');
    setDialog(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', type: 'banner', file_url: '', thumbnail_url: '', content: '' });
    setUploadProgress('');
    setDialog(true);
  };

  const filtered = typeFilter === 'all' ? materials : materials.filter(m => m.type === typeFilter);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${typeFilter === 'all' ? 'text-[hsl(222_47%_11%)] font-bold' : 'bg-muted/50 text-muted-foreground'}`}
            style={typeFilter === 'all' ? { background: 'hsl(var(--primary))' } : {}}>All</button>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${typeFilter === k ? 'text-[hsl(222_47%_11%)] font-bold' : 'bg-muted/50 text-muted-foreground'}`}
              style={typeFilter === k ? { background: 'hsl(var(--primary))' } : {}}>{v.label}</button>
          ))}
        </div>
        {isAdmin && (
          <Button onClick={openNew} size="sm" style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Material
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Image className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'No materials yet. Add banners, social graphics, or message templates.' : 'No marketing materials available yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MaterialCard key={m.id} item={m} isAdmin={isAdmin}
              onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Material' : 'Add Marketing Material'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. A4 Banner — English" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
            </div>
            {form.type === 'whatsapp_msg' ? (
              <div className="space-y-1.5">
                <Label>Message Content *</Label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="WhatsApp message text…"
                  rows={5}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            ) : (
              <>
                {/* Direct file upload */}
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  {form.file_url ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{form.file_url.split('/').pop()}</p>
                        <p className="text-xs text-muted-foreground">File ready</p>
                      </div>
                      {form.thumbnail_url && (
                        <img src={form.thumbnail_url} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-border" />
                      )}
                      <button onClick={removeFile} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                      onDragLeave={e => { e.currentTarget.classList.remove('border-primary'); }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-primary');
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileUpload(file);
                      }}
                      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {uploading ? (
                        <><Loader2 className="w-6 h-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">{uploadProgress}</p></>
                      ) : (
                        <><Upload className="w-6 h-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Click or drag a file to upload</p><p className="text-xs text-muted-foreground/60">Images, videos — max 50MB</p></>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx" onChange={e => { const f = e.target.files[0]; if (f) handleFileUpload(f); }} />
                </div>

                {/* Manual URL option (advanced) */}
                <details className="space-y-1.5">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">Or paste a URL manually</summary>
                  <div className="space-y-2 pt-2">
                    <Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://…" />
                    <Input value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="Thumbnail URL (optional)" />
                  </div>
                </details>
              </>
            )}
            <Button className="w-full" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
              {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update' : 'Add Material'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.95)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <img src={lightboxUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
              border: 'none', color: 'white', padding: 8, borderRadius: '50%', cursor: 'pointer'
            }}
          >
            <X style={{ width: 24, height: 24 }} />
          </button>
        </div>
      )}
    </div>
  );
}
