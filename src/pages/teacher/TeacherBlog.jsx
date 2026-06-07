import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus, Edit2, Trash2, Eye, Loader2, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const STATUS_COLORS = {
  published: 'bg-success/10 text-success border-success/20',
  draft:     'bg-muted text-muted-foreground border-border',
  archived:  'bg-destructive/10 text-destructive border-destructive/20',
};

const EMPTY_FORM = { title: '', slug: '', excerpt: '', content: '', cover_image: '', tags: [], status: 'draft' };

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function TeacherBlog() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['teacherBlogPosts', user?.id],
    queryFn: () => base44.entities.BlogPost.filter({ created_by: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM, author_name: user?.full_name || '' }); setTagInput(''); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ title: p.title || '', slug: p.slug || '', excerpt: p.excerpt || '', content: p.content || '', cover_image: p.cover_image || '', author_name: p.author_name || user?.full_name || '', tags: p.tags || [], status: p.status || 'draft' });
    setTagInput('');
    setOpen(true);
  };

  const set = (k, v) => setForm(f => ({
    ...f, [k]: v,
    ...(k === 'title' && !editing ? { slug: slugify(v) } : {}),
  }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };
  const removeTag = (t) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        author_name: form.author_name || user?.full_name,
        published_at: form.status === 'published' ? (editing?.published_at || new Date().toISOString()) : undefined,
      };
      if (editing) return base44.entities.BlogPost.update(editing.id, payload);
      return base44.entities.BlogPost.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] });
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      toast.success(editing ? 'Post updated!' : 'Post submitted for review!');
      setOpen(false);
    },
    onError: () => toast.error('Could not save post'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] });
      toast.success('Post deleted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" /> My Blog Posts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Share knowledge with students</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Write Post</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground mb-4">You haven't written any blog posts yet.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Write Your First Post</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/30 transition-colors">
              {post.cover_image && (
                <img src={post.cover_image} alt={post.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 hidden sm:block" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold truncate">{post.title}</p>
                  <Badge className={`text-[10px] capitalize flex-shrink-0 ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{post.excerpt || 'No excerpt'}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(post)}><Edit2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                  onClick={() => { if(confirm('Delete this post?')) deleteMutation.mutate(post.id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Post' : 'Write New Post'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Post title" className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                    <SelectItem value="published">Publish Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cover Image URL</Label>
              <Input value={form.cover_image} onChange={e => set('cover_image', e.target.value)} placeholder="https://…" className="mt-1" />
              {form.cover_image && <img src={form.cover_image} alt="cover" className="mt-2 h-28 object-cover rounded-lg border border-border" />}
            </div>
            <div>
              <Label>Excerpt</Label>
              <Input value={form.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Short summary…" className="mt-1" />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Type tag + Enter" />
                <Button type="button" variant="outline" onClick={addTag}><Tag className="w-4 h-4" /></Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(t => (
                    <Badge key={t} className="bg-accent/10 text-accent border-accent/20 capitalize gap-1 cursor-pointer" onClick={() => removeTag(t)}>
                      {t} <X className="w-3 h-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Content</Label>
              <div className="mt-1 rounded-lg overflow-hidden border border-border" style={{ minHeight: 280 }}>
                <ReactQuill theme="snow" value={form.content} onChange={v => set('content', v)} style={{ minHeight: 240 }}
                  modules={{ toolbar: [[{ header: [1,2,3,false] }],['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['blockquote','code-block'],['link','image'],['clean']] }}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title} className="flex-1">
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update Post' : 'Save Post'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
