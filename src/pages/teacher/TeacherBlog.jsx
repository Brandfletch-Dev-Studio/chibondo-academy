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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Plus, Edit2, Trash2, Eye, EyeOff, Loader2, Tag, X, Newspaper, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CATEGORIES = ['Biology','Chemistry','Physics','Mathematics','English','History','Geography','Study Tips','Exam Strategy','Career Guidance','General'];
const STATUS_COLORS = { published:'bg-success/10 text-success border-success/20', draft:'bg-muted text-muted-foreground border-border', archived:'bg-destructive/10 text-destructive border-destructive/20' };
const EMPTY = { title:'', slug:'', excerpt:'', content:'', cover_image:'', category:'General', tags:[], status:'draft', meta_title:'', meta_description:'', is_featured:false };
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const QUILL_MODULES = { toolbar:[[{header:[1,2,3,false]}],['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['blockquote','code-block'],['link','image'],['clean']] };

export default function TeacherBlog() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('content');

  const { data: tutorProfiles = [] } = useQuery({
    queryKey: ['myTutorProfile', user?.id],
    queryFn: () => base44.entities.TutorProfile.filter({ user_id: user?.id }),
    enabled: !!user?.id,
  });
  const myProfile = tutorProfiles[0];

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['teacherBlogPosts', user?.id],
    queryFn: () => base44.entities.BlogPost.filter({ created_by: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      author_name: myProfile?.full_name || user?.full_name || '',
      author_photo: myProfile?.profile_photo || '',
      tutor_profile_id: myProfile?.id || '',
      tutor_slug: myProfile?.slug || '',
    });
    setTagInput(''); setActiveTab('content'); setOpen(true);
  };
  const openEdit = p => {
    setEditing(p);
    setForm({ ...EMPTY, ...p, tags:p.tags||[], is_featured:!!p.is_featured });
    setTagInput(''); setActiveTab('content'); setOpen(true);
  };

  const set = (k,v) => setForm(f => ({
    ...f, [k]:v,
    ...(k==='title' && !editing ? { slug:slugify(v), meta_title:v.slice(0,60) } : {}),
    ...(k==='excerpt' && !editing ? { meta_description:v.slice(0,160) } : {}),
  }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f=>({...f,tags:[...f.tags,t]}));
    setTagInput('');
  };
  const removeTag = t => setForm(f=>({...f,tags:f.tags.filter(x=>x!==t)}));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        author_name: form.author_name || myProfile?.full_name || user?.full_name,
        tutor_profile_id: form.tutor_profile_id || myProfile?.id || '',
        tutor_slug: form.tutor_slug || myProfile?.slug || '',
        published_at: form.status==='published' ? (editing?.published_at||new Date().toISOString()) : form.published_at,
      };
      if (editing) return base44.entities.BlogPost.update(editing.id, payload);
      return base44.entities.BlogPost.create(payload);
    },
    onSuccess: (savedPost) => {
      queryClient.invalidateQueries({ queryKey:['teacherBlogPosts'] });
      queryClient.invalidateQueries({ queryKey:['blogPosts'] });
      toast.success(editing ? 'Post updated!' : 'Post saved!');
      setOpen(false);
      // Notify subscribers when published (fire-and-forget)
      const wasPublished = !editing && form.status === 'published';
      const justPublished = editing && editing.status !== 'published' && form.status === 'published';
      if (wasPublished || justPublished) {
        base44.functions.invoke('notifyNewBlogPost', {
          event: { type: editing ? 'update' : 'create' },
          data: savedPost,
          old_data: editing || null,
        }).catch(() => {});
      }
    },
    onError: () => toast.error('Could not save post'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.BlogPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['teacherBlogPosts'] });
      toast.success('Post deleted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-accent" /> My Blog Posts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Share your knowledge with students</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Write Post</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="font-semibold mb-1">No articles yet</p>
          <p className="text-sm text-muted-foreground mb-4">Share your subject expertise with students.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Write Your First Post</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/30 transition-colors">
              {post.cover_image
                ? <img src={post.cover_image} alt={post.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 hidden sm:block" />
                : <div className="w-12 h-12 rounded-lg bg-muted hidden sm:flex items-center justify-center flex-shrink-0"><Newspaper className="w-5 h-5 opacity-20" /></div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{post.title}</p>
                  <Badge className={`text-[10px] capitalize flex-shrink-0 ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {post.category && <span className="mr-2">{post.category}</span>}
                  <span>{(post.view_count||0)} views</span>
                  {post.published_at && <span> · {format(new Date(post.published_at),'dd MMM yyyy')}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(post)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={()=>{ if(confirm('Delete this post?')) deleteMutation.mutate(post.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Post' : 'Write New Post'}</DialogTitle></DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="meta">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Article title" className="mt-1" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v=>set('category',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v=>set('status',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Save as Draft</SelectItem>
                      <SelectItem value="published">Publish Now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cover Image URL</Label>
                  <Input value={form.cover_image} onChange={e=>set('cover_image',e.target.value)} placeholder="https://…" className="mt-1" />
                </div>
              </div>
              {form.cover_image && <img src={form.cover_image} alt="cover" className="h-28 w-full object-cover rounded-lg border border-border" />}
              <div>
                <Label>Excerpt</Label>
                <Input value={form.excerpt} onChange={e=>set('excerpt',e.target.value)} placeholder="Short summary shown on cards" className="mt-1" />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addTag())} placeholder="Type tag + Enter" />
                  <Button type="button" variant="outline" onClick={addTag}><Tag className="w-4 h-4" /></Button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(t=><Badge key={t} className="bg-accent/10 text-accent border-accent/20 capitalize gap-1 cursor-pointer" onClick={()=>removeTag(t)}>{t}<X className="w-3 h-3"/></Badge>)}
                  </div>
                )}
              </div>
              <div>
                <Label>Content</Label>
                <div className="mt-1 rounded-lg overflow-hidden border border-border" style={{minHeight:320}}>
                  <ReactQuill theme="snow" value={form.content} onChange={v=>set('content',v)} style={{minHeight:280}} modules={QUILL_MODULES} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-sm mb-2">Google Preview</p>
                <p className="text-blue-500 font-medium truncate">{window.location.origin}/blog/{form.slug||'your-article-slug'}</p>
                <p className="font-semibold text-base text-foreground">{form.meta_title||form.title||'Article Title'}</p>
                <p className="text-muted-foreground">{form.meta_description||form.excerpt||'Description…'}</p>
              </div>
              <div>
                <Label>Meta Title <span className="text-muted-foreground text-xs">({form.meta_title.length}/60)</span></Label>
                <Input value={form.meta_title} onChange={e=>set('meta_title',e.target.value)} maxLength={70} placeholder="Defaults to title" className="mt-1" />
              </div>
              <div>
                <Label>Meta Description <span className="text-muted-foreground text-xs">({form.meta_description.length}/160)</span></Label>
                <Input value={form.meta_description} onChange={e=>set('meta_description',e.target.value)} maxLength={180} placeholder="Defaults to excerpt" className="mt-1" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-3 border-t border-border">
            <Button onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending||!form.title} className="flex-1">
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Saving…</> : editing ? 'Update Post' : 'Save Post'}
            </Button>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
