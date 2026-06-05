import React, { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  MessageSquare, ThumbsUp, Plus, Send, Reply, MoreVertical,
  Search, Filter, TrendingUp, Clock, Pin, Image, Mic, X,
  ChevronDown, ChevronUp, Heart, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const ROLE_BADGE = {
  admin:   { label: 'Admin',   cls: 'bg-destructive/10 text-destructive' },
  teacher: { label: 'Teacher', cls: 'bg-accent/10 text-accent' },
  user:    { label: 'Student', cls: 'bg-muted text-muted-foreground' },
};

const AVATAR_COLOR = {
  admin:   { bg: 'bg-destructive/20', text: 'text-destructive' },
  teacher: { bg: 'bg-accent/20',      text: 'text-accent' },
  user:    { bg: 'bg-primary/10',      text: 'text-primary' },
};

function UserAvatar({ name, role, size = 'md' }) {
  const c = AVATAR_COLOR[role] || AVATAR_COLOR.user;
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <Avatar className={sz}>
      <AvatarFallback className={`font-bold ${c.bg} ${c.text}`}>{name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
    </Avatar>
  );
}

// ─── Reply Item ────────────────────────────────────────────────────────────────
function ReplyItem({ reply, user, onLike, onDelete }) {
  const badge = ROLE_BADGE[reply.author_role] || ROLE_BADGE.user;
  const isOwner = user?.id === reply.author_id || user?.role === 'admin';

  return (
    <div className="flex gap-3 py-3">
      {/* indent line */}
      <div className="flex flex-col items-center">
        <UserAvatar name={reply.author_name} role={reply.author_role} size="sm" />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="bg-muted/40 rounded-xl rounded-tl-none px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold">{reply.author_name}</span>
            <Badge className={`text-[9px] border-0 ${badge.cls}`}>{badge.label}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{reply.content}</p>
          {reply.image_url && (
            <img src={reply.image_url} alt="attachment" className="mt-2 max-h-48 rounded-lg object-cover" />
          )}
          {reply.voice_note_url && (
            <audio controls src={reply.voice_note_url} className="mt-2 w-full h-8" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          <button onClick={() => onLike(reply)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <Heart className="w-3 h-3" /> {reply.likes || 0}
          </button>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(reply.created_date), { addSuffix: true })}</span>
          {isOwner && (
            <button onClick={() => onDelete(reply.id)} className="text-xs text-muted-foreground hover:text-destructive ml-auto">Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, replies, user, onLike, onDelete, onReply, allPosts }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyImage, setReplyImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const badge = ROLE_BADGE[post.author_role] || ROLE_BADGE.user;
  const isOwner = user?.id === post.author_id || user?.role === 'admin';
  const replyCount = replies.length;

  const handleReplyImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setReplyImage(file_url);
    setUploading(false);
  };

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(post.id, replyText, replyImage);
    setReplyText('');
    setReplyImage(null);
    setReplyOpen(false);
    setShowReplies(true);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-colors">
      {/* Post Header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <UserAvatar name={post.author_name} role={post.author_role} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{post.author_name}</span>
                  <Badge className={`text-[9px] border-0 ${badge.cls}`}>{badge.label}</Badge>
                  {post.is_pinned && <Badge className="text-[9px] bg-accent text-accent-foreground border-0">📌 Pinned</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}</span>
              </div>
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">Delete Post</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Title */}
            {post.title && <h3 className="font-display font-bold text-base mt-2 mb-1">{post.title}</h3>}

            {/* Content */}
            <p className="text-sm leading-relaxed text-foreground mt-1">{post.content}</p>

            {/* Image */}
            {post.image_url && (
              <img src={post.image_url} alt="attachment" className="mt-3 w-full max-h-72 rounded-xl object-cover border border-border" />
            )}
            {/* Voice note */}
            {post.voice_note_url && (
              <audio controls src={post.voice_note_url} className="mt-3 w-full" />
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/50">
          <button
            onClick={() => onLike(post)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors font-medium"
          >
            <Heart className="w-3.5 h-3.5" /> {post.likes || 0} Like
          </button>
          <button
            onClick={() => { setReplyOpen(!replyOpen); if (!replyOpen) setShowReplies(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors font-medium"
          >
            <Reply className="w-3.5 h-3.5" /> Reply
          </button>
          {replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors font-medium ml-auto"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Reply Input */}
      {replyOpen && (
        <div className="px-5 pb-4 border-t border-border/50 bg-muted/20">
          <div className="flex gap-3 pt-4">
            <UserAvatar name={user?.full_name} role={user?.role} size="sm" />
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm bg-card"
                autoFocus
              />
              {replyImage && (
                <div className="relative inline-block">
                  <img src={replyImage} alt="preview" className="h-20 rounded-lg object-cover border border-border" />
                  <button onClick={() => setReplyImage(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReplyImageUpload} />
                <button onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                </button>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="ghost" onClick={() => { setReplyOpen(false); setReplyText(''); setReplyImage(null); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyText.trim()}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Reply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replies (indented like Facebook) */}
      {showReplies && replyCount > 0 && (
        <div className="px-5 pb-2 border-t border-border/50 bg-muted/10">
          <div className="pl-4 border-l-2 border-border">
            {replies.map(reply => (
              <ReplyItem key={reply.id} reply={reply} user={user} onLike={onLike} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Post Dialog ───────────────────────────────────────────────────────────
function NewPostDialog({ open, onOpenChange, onSubmit, isPending }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const imgRef = useRef();
  const chunksRef = useRef([]);

  const reset = () => { setTitle(''); setContent(''); setImageUrl(null); setVoiceUrl(null); };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      setUploading(true);
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVoiceUrl(file_url);
      setUploading(false);
      stream.getTracks().forEach(t => t.stop());
    };
    mr.start();
    setMediaRecorder(mr);
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit({ title: title.trim(), content: content.trim(), image_url: imageUrl, voice_note_url: voiceUrl });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Start a Discussion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Input
            placeholder="Topic title (e.g. 'How do I solve quadratic equations?')"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="font-medium"
          />
          <Textarea
            placeholder="Share your question, thought, or topic with the community..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            className="resize-none"
          />

          {/* Media previews */}
          {imageUrl && (
            <div className="relative inline-block">
              <img src={imageUrl} alt="preview" className="h-32 rounded-xl border border-border object-cover" />
              <button onClick={() => setImageUrl(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {voiceUrl && (
            <div className="flex items-center gap-2">
              <audio controls src={voiceUrl} className="flex-1 h-10" />
              <button onClick={() => setVoiceUrl(null)} className="text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Attachment bar */}
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <button
              onClick={() => imgRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
            >
              {uploading && !recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
              Photo
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                recording ? 'text-destructive bg-destructive/10 animate-pulse' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
            >
              <Mic className="w-4 h-4" />
              {recording ? 'Stop' : 'Voice Note'}
            </button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!content.trim() || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DiscussionsPage() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // recent | popular | pinned

  const { data: allDiscussions = [], isLoading } = useQuery({
    queryKey: ['allDiscussions'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 300),
  });

  const rootPosts = allDiscussions.filter(d => !d.parent_id);
  const allReplies = allDiscussions.filter(d => !!d.parent_id);

  const getReplies = (parentId) => allReplies.filter(r => r.parent_id === parentId);

  // Filter + sort
  const filtered = rootPosts
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.author_name?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
      if (sortBy === 'pinned') return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      return new Date(b.created_date) - new Date(a.created_date);
    });

  const createMutation = useMutation({
    mutationFn: async ({ title, content, image_url, voice_note_url }) => {
      return base44.entities.Discussion.create({
        title: title || null,
        content,
        image_url: image_url || null,
        voice_note_url: voice_note_url || null,
        author_id: user.id,
        author_name: user.full_name,
        author_role: user.role,
        status: 'active',
        likes: 0,
        parent_id: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      setDialogOpen(false);
      toast.success('Discussion posted!');
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, content, image_url }) => {
      return base44.entities.Discussion.create({
        content,
        image_url: image_url || null,
        author_id: user.id,
        author_name: user.full_name,
        author_role: user.role,
        status: 'active',
        likes: 0,
        parent_id: parentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      toast.success('Reply posted!');
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (post) => base44.entities.Discussion.update(post.id, { likes: (post.likes || 0) + 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allDiscussions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.Discussion.update(id, { status: 'deleted' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDiscussions'] });
      toast.success('Deleted');
    },
  });

  const handleReply = (parentId, content, image_url) => {
    replyMutation.mutate({ parentId, content, image_url });
  };

  const stats = {
    posts: rootPosts.length,
    replies: allReplies.length,
    members: [...new Set(allDiscussions.map(d => d.author_id))].length,
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold mb-1">Community Forum</h1>
            <p className="text-primary-foreground/70 text-sm">Ask questions, share ideas, learn together</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80">
              <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {stats.posts} posts</span>
              <span className="flex items-center gap-1"><Reply className="w-3.5 h-3.5" /> {stats.replies} replies</span>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-white text-primary hover:bg-white/90 flex-shrink-0 font-semibold shadow"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Post
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search discussions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {[
            { key: 'recent', icon: Clock, label: 'Recent' },
            { key: 'popular', icon: TrendingUp, label: 'Popular' },
            { key: 'pinned', icon: Pin, label: 'Pinned' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              title={label}
              className={`p-2 rounded-md transition-colors ${
                sortBy === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">
            {search ? 'No discussions match your search' : 'No discussions yet'}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search ? 'Try different keywords' : 'Be the first to start a conversation!'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Start Discussion
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              replies={getReplies(post.id)}
              user={user}
              onLike={(p) => likeMutation.mutate(p)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onReply={handleReply}
              allPosts={allDiscussions}
            />
          ))}
        </div>
      )}

      <NewPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}