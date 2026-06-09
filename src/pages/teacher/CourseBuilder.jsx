import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Plus, Edit2, Trash2, PlayCircle, FileText, ImageIcon,
  Loader2, ChevronDown, ChevronRight, GripVertical, Copy,
  Save, Clock, Wifi, WifiOff, Youtube, Globe, Upload,
  BookOpen, Layers, BarChart3, CheckCircle2, AlertCircle,
  X, Video, Link2, Settings, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ],
};

// ─── AUTO-SAVE HOOK ────────────────────────────────────────────────────────────
function useAutoSave(saveFn, delay = 1500) {
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const timerRef = useRef(null);
  const lastSavedRef = useRef(null);

  const trigger = useCallback((data) => {
    setStatus('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(data);
        lastSavedRef.current = new Date();
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 3000);
      } catch {
        setStatus('error');
      }
    }, delay);
  }, [saveFn, delay]);

  return { status, lastSaved: lastSavedRef.current, trigger };
}

// ─── SAVE STATUS INDICATOR ─────────────────────────────────────────────────────
function SaveStatus({ status, lastSaved }) {
  if (status === 'idle' && !lastSaved) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === 'saving' || status === 'pending' ? (
        <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
      ) : status === 'saved' ? (
        <><CheckCircle2 className="w-3 h-3 text-green-500" /> Saved</>
      ) : status === 'error' ? (
        <><AlertCircle className="w-3 h-3 text-destructive" /> Save failed</>
      ) : lastSaved ? (
        <><CheckCircle2 className="w-3 h-3 text-green-500/60" /> Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</>
      ) : null}
    </span>
  );
}

// ─── YOUTUBE METADATA FETCHER ─────────────────────────────────────────────────
async function fetchYouTubeMeta(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!match) return null;
  const videoId = match[1];
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!r.ok) return { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` };
    const data = await r.json();
    return {
      videoId,
      title: data.title,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  } catch {
    return { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` };
  }
}

// ─── BUNNY.NET EMBED HELPER ───────────────────────────────────────────────────
function getBunnyEmbed(input) {
  // Accept full embed URL or just video ID
  const embedMatch = input.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/);
  if (embedMatch) return `https://iframe.mediadelivery.net/embed/${embedMatch[1]}/${embedMatch[2]}`;
  const idMatch = input.match(/^[a-f0-9-]{36}$/);
  if (idMatch) return input; // raw video ID — user needs to provide library too
  return input;
}

// ─── VIDEO INPUT SECTION ──────────────────────────────────────────────────────
function VideoInput({ lesson, onChange }) {
  const [provider, setProvider] = useState(lesson.video_provider || 'none');
  const [urlInput, setUrlInput] = useState(lesson.video_url || '');
  const [fetching, setFetching] = useState(false);
  const [meta, setMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    setProvider(lesson.video_provider || 'none');
    setUrlInput(lesson.video_url || '');
  }, [lesson.id]);

  const handleProviderChange = (val) => {
    setProvider(val);
    setMeta(null);
    onChange({ video_provider: val, video_url: '' });
    setUrlInput('');
  };

  const handleUrlBlur = async () => {
    if (!urlInput) return;
    if (provider === 'youtube') {
      setFetching(true);
      const m = await fetchYouTubeMeta(urlInput);
      setFetching(false);
      if (m) {
        setMeta(m);
        onChange({ video_url: urlInput, video_provider: 'youtube' });
        toast.success('YouTube video linked');
      } else {
        toast.error('Could not parse YouTube URL');
      }
    } else if (provider === 'bunny') {
      const embed = getBunnyEmbed(urlInput);
      onChange({ video_url: urlInput, video_provider: 'bunny' });
      toast.success('Bunny.net video linked');
    } else {
      onChange({ video_url: urlInput, video_provider: provider });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    // Simulate progress while uploading
    const interval = setInterval(() => setUploadProgress(p => Math.min(p + 10, 90)), 400);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      clearInterval(interval);
      setUploadProgress(100);
      onChange({ video_url: file_url, video_provider: 'upload' });
      setUrlInput(file_url);
      toast.success('Video uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      clearInterval(interval);
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1.5 block">Video Source</Label>
        <div className="flex gap-2 flex-wrap">
          {[
            { val: 'none', label: 'None', icon: X },
            { val: 'youtube', label: 'YouTube', icon: Youtube },
            { val: 'bunny', label: 'Bunny.net', icon: Video },
            { val: 'upload', label: 'Upload', icon: Upload },
            { val: 'external', label: 'External URL', icon: Globe },
          ].map(({ val, label, icon: Icon }) => (
            <button key={val} onClick={() => handleProviderChange(val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                provider === val
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {provider === 'upload' && (
        <div className="space-y-2">
          <label className="block">
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
            <div className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors ${uploading ? 'pointer-events-none opacity-70' : ''}`}>
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Uploading…</p>
                  <div className="w-full max-w-xs bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Click to upload video</p>
                  <p className="text-xs text-muted-foreground/60">MP4, WebM, MOV supported</p>
                </>
              )}
            </div>
          </label>
          {urlInput && !uploading && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Video uploaded successfully
            </div>
          )}
        </div>
      )}

      {(provider === 'youtube' || provider === 'bunny' || provider === 'external') && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder={
                provider === 'youtube' ? 'https://www.youtube.com/watch?v=...'
                : provider === 'bunny' ? 'Bunny video ID or embed URL'
                : 'https://...'
              }
              className="flex-1 text-sm"
            />
            {fetching && <Loader2 className="w-4 h-4 animate-spin self-center text-muted-foreground" />}
          </div>

          {/* YouTube preview */}
          {provider === 'youtube' && meta && (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
              <img src={meta.thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{meta.title || 'YouTube Video'}</p>
                <p className="text-xs text-muted-foreground">YouTube · Linked</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            </div>
          )}

          {/* Bunny preview */}
          {provider === 'bunny' && urlInput && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-700">
              <Video className="w-3.5 h-3.5 flex-shrink-0" /> Bunny.net video linked
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── LESSON ATTACHMENTS ───────────────────────────────────────────────────────
function AttachmentsPanel({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newAttachment = {
        id: Date.now().toString(),
        name: file.name,
        url: file_url,
        type: file.type,
        size: file.size,
      };
      onChange([...attachments, newAttachment]);
      toast.success('File attached');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (id) => onChange(attachments.filter(a => a.id !== id));

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return Math.round(bytes/1024) + 'KB';
    return (bytes/1048576).toFixed(1) + 'MB';
  };

  const fileIcon = (type = '') => {
    if (type.startsWith('image/')) return '\u{1F5BC}\uFE0F';
    if (type.includes('pdf')) return '\u{1F4C4}';
    if (type.includes('word') || type.includes('doc')) return '\u{1F4DD}';
    if (type.includes('spreadsheet') || type.includes('excel')) return '\u{1F4CA}';
    if (type.startsWith('video/')) return '\u{1F3AC}';
    return '\u{1F4CE}';
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 bg-muted/40 border border-border rounded-xl group">
              <span className="text-lg flex-shrink-0">{fileIcon(att.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{att.name}</p>
                {att.size && <p className="text-[10px] text-muted-foreground">{formatSize(att.size)}</p>}
              </div>
              <a href={att.url} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => removeAttachment(att.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
        <div className={\`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground \${uploading ? 'opacity-50 pointer-events-none' : ''}\`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Click to attach a file'}
        </div>
      </label>
      <p className="text-[10px] text-muted-foreground">PDFs, images, Word docs, spreadsheets, and more. Students will see these below the lesson.</p>
    </div>
  );
}

// ─── LESSON QUIZ BUILDER ──────────────────────────────────────────────────────
const QTYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
];

function QuestionCard({ q, idx, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(idx === 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <p className="flex-1 text-xs truncate text-muted-foreground">{q.question || 'Untitled question'}</p>
        <Badge className="text-[9px] h-4">{QTYPES.find(t => t.value === q.type)?.label || q.type}</Badge>
        <span className="text-[10px] text-muted-foreground">{q.points || 1}pt</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          <div>
            <Label className="text-[10px]">Question</Label>
            <Textarea value={q.question} onChange={e => onChange({ ...q, question: e.target.value })}
              placeholder="Enter your question…" className="mt-1 text-xs min-h-[60px] resize-none" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-[10px]">Type</Label>
              <Select value={q.type} onValueChange={v => {
                const base = { ...q, type: v, options: ['', '', '', ''], correct_answer: '' };
                if (v === 'true_false') base.options = ['True', 'False'];
                onChange(base);
              }}>
                <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QTYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Label className="text-[10px]">Points</Label>
              <Input type="number" value={q.points || 1} min={1}
                onChange={e => onChange({ ...q, points: Number(e.target.value) })}
                className="h-7 text-xs mt-1" />
            </div>
          </div>

          {(q.type === 'multiple_choice' || q.type === 'true_false') && (
            <div className="space-y-2">
              <Label className="text-[10px]">Options (click circle to mark correct)</Label>
              {(q.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button onClick={() => onChange({ ...q, correct_answer: opt })}
                    className={\`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors \${
                      q.correct_answer === opt ? 'border-green-500 bg-green-500' : 'border-border'
                    }\`} />
                  <Input value={opt} onChange={e => {
                    const opts = [...(q.options || [])];
                    opts[oi] = e.target.value;
                    onChange({ ...q, options: opts });
                  }} className="h-7 text-xs flex-1" placeholder={\`Option \${oi + 1}\`}
                  disabled={q.type === 'true_false'} />
                </div>
              ))}
              {q.type === 'multiple_choice' && (q.options || []).length < 6 && (
                <button onClick={() => onChange({ ...q, options: [...(q.options || []), ''] })}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add option
                </button>
              )}
            </div>
          )}

          {(q.type === 'fill_blank' || q.type === 'short_answer') && (
            <div>
              <Label className="text-[10px]">Correct Answer</Label>
              <Input value={q.correct_answer || ''} onChange={e => onChange({ ...q, correct_answer: e.target.value })}
                placeholder={q.type === 'fill_blank' ? 'Expected answer (exact match)' : 'Model answer (for manual grading)'}
                className="mt-1 text-xs h-7" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizPanel({ lesson, subjectId }) {
  const qc = useQueryClient();
  const [questions, setQuestions] = useState([]);
  const [quizMeta, setQuizMeta] = useState({ title: '', time_limit_minutes: 0, pass_percentage: 60, status: 'draft' });
  const [quizId, setQuizId] = useState(null);
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const { data: existingQuizzes = [], isLoading } = useQuery({
    queryKey: ['lessonQuiz', lesson.id],
    queryFn: () => base44.entities.Quiz.filter({ lesson_id: lesson.id }, '-created_date', 1),
  });

  useEffect(() => {
    if (existingQuizzes.length > 0) {
      const q = existingQuizzes[0];
      setQuizId(q.id);
      setQuizMeta({ title: q.title || '', time_limit_minutes: q.time_limit_minutes || 0, pass_percentage: q.pass_percentage || 60, status: q.status || 'draft' });
      setQuestions(q.questions || []);
    } else {
      setQuizId(null);
      setQuizMeta({ title: '', time_limit_minutes: 0, pass_percentage: 60, status: 'draft' });
      setQuestions([]);
    }
  }, [existingQuizzes.length, lesson.id]);

  const autoSave = (meta, qs) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const payload = { ...meta, questions: qs, lesson_id: lesson.id, subject_id: subjectId, lesson_title: lesson.title };
        let id = quizId;
        if (id) {
          await base44.entities.Quiz.update(id, payload);
        } else {
          const created = await base44.entities.Quiz.create(payload);
          id = created.id;
          setQuizId(id);
        }
        qc.invalidateQueries({ queryKey: ['lessonQuiz', lesson.id] });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
      }
    }, 1000);
  };

  const setMeta = (k, v) => {
    const updated = { ...quizMeta, [k]: v };
    setQuizMeta(updated);
    autoSave(updated, questions);
  };

  const setQs = (qs) => {
    setQuestions(qs);
    autoSave(quizMeta, qs);
  };

  const addQuestion = () => setQs([...questions, {
    id: Date.now().toString(), type: 'multiple_choice',
    question: '', options: ['', '', '', ''], correct_answer: '', points: 1,
  }]);

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quiz Title</Label>
          <Input value={quizMeta.title} onChange={e => setMeta('title', e.target.value)}
            placeholder={lesson.title + ' Quiz'} className="mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={quizMeta.status} onValueChange={v => setMeta('status', v)}>
            <SelectTrigger className="mt-1 text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Time Limit (min, 0 = unlimited)</Label>
          <Input type="number" min={0} value={quizMeta.time_limit_minutes}
            onChange={e => setMeta('time_limit_minutes', Number(e.target.value))}
            className="mt-1 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Pass Percentage (%)</Label>
          <Input type="number" min={0} max={100} value={quizMeta.pass_percentage}
            onChange={e => setMeta('pass_percentage', Number(e.target.value))}
            className="mt-1 text-sm" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Questions ({questions.length})</p>
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} lastSaved={null} />
          <Button size="sm" onClick={addQuestion} className="h-7 text-xs gap-1"
            style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
            <Plus className="w-3 h-3" /> Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-border rounded-xl gap-2">
          <ClipboardList className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">No questions yet</p>
          <button onClick={addQuestion} className="text-xs text-primary hover:underline">Add first question</button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} idx={i}
              onChange={updated => { const qs = [...questions]; qs[i] = updated; setQs(qs); }}
              onDelete={() => setQs(questions.filter((_, idx) => idx !== i))}
            />
          ))}
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>Total: {questions.reduce((s,q) => s + (q.points||1), 0)} points</span>
            <span>{questions.filter(q => q.question && q.correct_answer).length}/{questions.length} complete</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LESSON ASSIGNMENT BUILDER ────────────────────────────────────────────────
function AssignmentPanel({ lesson, subjectId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', instructions: '', due_date: '',
    total_marks: 100, status: 'draft', attachments: [],
  });
  const [assignmentId, setAssignmentId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const saveTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['lessonAssignment', lesson.id],
    queryFn: () => base44.entities.Assignment.filter({ lesson_id: lesson.id }, '-created_date', 1),
  });

  useEffect(() => {
    if (existing.length > 0) {
      const a = existing[0];
      setAssignmentId(a.id);
      setForm({
        title: a.title || '',
        description: a.description || '',
        instructions: a.instructions || '',
        due_date: a.due_date ? a.due_date.split('T')[0] : '',
        total_marks: a.total_marks || 100,
        status: a.status || 'draft',
        attachments: a.attachments || [],
      });
    } else {
      setAssignmentId(null);
      setForm({ title: '', description: '', instructions: '', due_date: '', total_marks: 100, status: 'draft', attachments: [] });
    }
  }, [existing.length, lesson.id]);

  const autoSave = (updated) => {
    clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const payload = { ...updated, lesson_id: lesson.id, subject_id: subjectId, lesson_title: lesson.title };
        if (assignmentId) {
          await base44.entities.Assignment.update(assignmentId, payload);
        } else {
          const created = await base44.entities.Assignment.create(payload);
          setAssignmentId(created.id);
        }
        qc.invalidateQueries({ queryKey: ['lessonAssignment', lesson.id] });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
      }
    }, 1000);
  };

  const set = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    autoSave(updated);
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const att = { id: Date.now().toString(), name: file.name, url: file_url, type: file.type, size: file.size };
      const updated = { ...form, attachments: [...(form.attachments || []), att] };
      setForm(updated);
      autoSave(updated);
      toast.success('File attached');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{assignmentId ? 'Editing — auto-saving' : 'No assignment yet for this lesson'}</p>
        <SaveStatus status={saveStatus} lastSaved={null} />
      </div>

      <div>
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={lesson.title + ' Assignment'} className="mt-1" />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Brief description shown on student dashboard" className="mt-1 text-sm resize-none" rows={2} />
      </div>

      <div>
        <Label className="text-xs">Instructions</Label>
        <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)}
          placeholder="Detailed step-by-step instructions…" className="mt-1 text-sm" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Total Marks</Label>
          <Input type="number" value={form.total_marks} min={1}
            onChange={e => set('total_marks', Number(e.target.value))} className="mt-1" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1 text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Attached Resources (for students)</Label>
        {(form.attachments || []).map(att => (
          <div key={att.id} className="flex items-center gap-2 p-2 bg-muted/40 border border-border rounded-lg mb-1.5 group">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs flex-1 truncate">{att.name}</span>
            <a href={att.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex-shrink-0">Open</a>
            <button onClick={() => set('attachments', form.attachments.filter(a => a.id !== att.id))}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="block mt-1">
          <input type="file" className="sr-only" onChange={handleAttachmentUpload} disabled={uploading} />
          <div className={\`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs text-muted-foreground \${uploading ? 'opacity-50 pointer-events-none' : ''}\`}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Attach a resource file'}
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── LESSON EXTRAS PANEL (tabs: Attachments / Quiz / Assignment) ──────────────
function LessonExtrasPanel({ lesson, subjectId, onChange }) {
  return (
    <Tabs defaultValue="attachments" className="w-full">
      <TabsList className="w-full h-8 mb-3">
        <TabsTrigger value="attachments" className="flex-1 text-xs gap-1.5">
          <Upload className="w-3 h-3" /> Attachments
        </TabsTrigger>
        <TabsTrigger value="quiz" className="flex-1 text-xs gap-1.5">
          <ClipboardList className="w-3 h-3" /> Quiz
        </TabsTrigger>
        <TabsTrigger value="assignment" className="flex-1 text-xs gap-1.5">
          <FileText className="w-3 h-3" /> Assignment
        </TabsTrigger>
      </TabsList>

      <TabsContent value="attachments">
        <AttachmentsPanel
          attachments={lesson.attachments || []}
          onChange={(atts) => onChange('attachments', atts)}
        />
      </TabsContent>

      <TabsContent value="quiz">
        <QuizPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>

      <TabsContent value="assignment">
        <AssignmentPanel lesson={lesson} subjectId={subjectId} />
      </TabsContent>
    </Tabs>
  );
}

// ─── LESSON EDITOR (RIGHT PANEL) ──────────────────────────────────────────────
function LessonEditor({ lesson, subjectId, subjectName, onSaved }) {
  const qc = useQueryClient();
  const [data, setData] = useState(lesson);
  const pendingRef = useRef(null);

  // Sync when selected lesson changes
  useEffect(() => {
    setData(lesson);
    pendingRef.current = null;
  }, [lesson.id]);

  const saveFn = useCallback(async (payload) => {
    await base44.entities.Lesson.update(lesson.id, payload);
    qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
    onSaved?.();
  }, [lesson.id, subjectId]);

  const { status: saveStatus, lastSaved, trigger: triggerSave } = useAutoSave(saveFn, 1200);

  const set = (key, val) => {
    const updated = { ...data, [key]: val };
    setData(updated);
    triggerSave(updated);
  };

  const setVideo = (videoFields) => {
    const updated = { ...data, ...videoFields };
    setData(updated);
    triggerSave(updated);
  };

  const setContent = (val) => {
    const updated = { ...data, content: val };
    setData(updated);
    triggerSave(updated);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold truncate max-w-[200px]">{data.title || 'Untitled Lesson'}</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} lastSaved={lastSaved} />
          <Select value={data.status || 'draft'} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable editor body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Basic info */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Lesson Title</Label>
            <Input
              value={data.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Introduction to Photosynthesis"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={data.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of this lesson"
              className="mt-1"
            />
          </div>
        </div>

        {/* Video */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Video Content</h3>
          </div>
          <VideoInput lesson={data} onChange={setVideo} />
          {/* Manual duration fallback */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={data.estimated_minutes || ''}
                onChange={e => set('estimated_minutes', parseInt(e.target.value) || 0)}
                placeholder="e.g. 15"
                className="mt-1 h-8 text-sm"
                min={0}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Order</Label>
              <Input
                type="number"
                value={data.order || 0}
                onChange={e => set('order', parseInt(e.target.value) || 0)}
                className="mt-1 h-8 text-sm"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Lesson Notes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Lesson Notes</h3>
          </div>
          <div className="rounded-xl overflow-hidden border border-border">
            <ReactQuill
              theme="snow"
              value={data.content || ''}
              onChange={setContent}
              modules={QUILL_MODULES}
              style={{ minHeight: 200 }}
            />
          </div>
        </div>

        {/* Access */}
        <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
          <div>
            <p className="text-sm font-medium">Free Lesson</p>
            <p className="text-xs text-muted-foreground">Visible to all users, not just subscribers</p>
          </div>
          <Switch checked={!!data.is_free} onCheckedChange={v => set('is_free', v)} />
        </div>

        {/* ── Attachments / Quiz / Assignment tabs ── */}
        <LessonExtrasPanel lesson={data} subjectId={subjectId} onChange={set} />
      </div>
    </div>
  );
}

// ─── CURRICULUM TREE (LEFT PANEL) ─────────────────────────────────────────────
function CurriculumTree({
  topics, lessons, selectedLessonId, onSelectLesson,
  onAddTopic, onEditTopic, onDeleteTopic,
  onAddLesson, onDeleteLesson, onDuplicateLesson,
  subjectId,
}) {
  const [expandedTopics, setExpandedTopics] = useState({});
  const [hoveredLesson, setHoveredLesson] = useState(null);
  const [hoveredTopic, setHoveredTopic] = useState(null);

  const toggleTopic = (id) => setExpandedTopics(p => ({ ...p, [id]: !p[id] }));

  const lessonsByTopic = {};
  lessons.forEach(l => {
    if (!lessonsByTopic[l.topic_id]) lessonsByTopic[l.topic_id] = [];
    lessonsByTopic[l.topic_id].push(l);
  });
  Object.values(lessonsByTopic).forEach(arr => arr.sort((a, b) => (a.order || 0) - (b.order || 0)));

  return (
    <div className="h-full flex flex-col">
      {/* Tree header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Curriculum</span>
        </div>
        <Button size="sm" onClick={onAddTopic}
          className="h-7 text-xs gap-1"
          style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
          <Plus className="w-3 h-3" /> Topic
        </Button>
      </div>

      {/* Tree body */}
      <div className="flex-1 overflow-y-auto py-2">
        {topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No topics yet</p>
            <button onClick={onAddTopic} className="text-xs text-primary mt-1 hover:underline">Add your first topic</button>
          </div>
        ) : (
          topics.map((topic, tIdx) => {
            const topicLessons = lessonsByTopic[topic.id] || [];
            const expanded = expandedTopics[topic.id] !== false; // default expanded
            return (
              <div key={topic.id} className="mb-1">
                {/* Topic row */}
                <div
                  className="flex items-center gap-1 px-3 py-2 group cursor-pointer hover:bg-muted/50 transition-colors"
                  onMouseEnter={() => setHoveredTopic(topic.id)}
                  onMouseLeave={() => setHoveredTopic(null)}
                  onClick={() => toggleTopic(topic.id)}
                >
                  <button className="text-muted-foreground/50 flex-shrink-0">
                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <div className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {tIdx + 1}
                  </div>
                  <span className="flex-1 text-xs font-semibold truncate">{topic.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{topicLessons.length}</span>
                  {hoveredTopic === topic.id && (
                    <div className="flex items-center gap-0.5 ml-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onAddLesson(topic)}
                        className="p-1 rounded hover:bg-primary/10 text-primary" title="Add lesson">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => onEditTopic(topic)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground" title="Edit topic">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDeleteTopic(topic.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Delete topic">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Lessons */}
                {expanded && (
                  <div className="ml-6 border-l border-border/60 pl-2 space-y-0.5 pb-1">
                    {topicLessons.map((lesson) => (
                      <div key={lesson.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group cursor-pointer transition-colors ${
                          selectedLessonId === lesson.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/60 text-muted-foreground'
                        }`}
                        onMouseEnter={() => setHoveredLesson(lesson.id)}
                        onMouseLeave={() => setHoveredLesson(null)}
                        onClick={() => onSelectLesson(lesson)}
                      >
                        <PlayCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="flex-1 text-xs truncate">{lesson.title || 'Untitled'}</span>
                        {lesson.status === 'published'
                          ? <Eye className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                          : <EyeOff className="w-2.5 h-2.5 flex-shrink-0 opacity-30" />
                        }
                        {hoveredLesson === lesson.id && (
                          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => onDuplicateLesson(lesson)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="Duplicate">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => onDeleteLesson(lesson.id)}
                              className="p-0.5 rounded hover:bg-destructive/10 text-destructive" title="Delete">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Add lesson inline */}
                    <button onClick={() => onAddLesson(topic)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-colors w-full">
                      <Plus className="w-3 h-3" /> Add lesson
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── COURSE DETAILS PANEL ─────────────────────────────────────────────────────
function CourseDetailsPanel({ subject, tutors, user, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: subject.name || '',
    description: subject.description || '',
    cover_image: subject.cover_image || '',
    status: subject.status || 'draft',
    is_premium: subject.is_premium ?? true,
    teacher_id: subject.teacher_id || '',
    teacher_name: subject.teacher_name || '',
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: subject.name || '',
      description: subject.description || '',
      cover_image: subject.cover_image || '',
      status: subject.status || 'draft',
      is_premium: subject.is_premium ?? true,
      teacher_id: subject.teacher_id || '',
      teacher_name: subject.teacher_name || '',
    });
  }, [subject.id]);

  const saveFn = useCallback(async (payload) => {
    await base44.entities.Subject.update(subject.id, payload);
    qc.invalidateQueries({ queryKey: ['subject', subject.id] });
    onSaved?.();
  }, [subject.id]);

  const { status: saveStatus, lastSaved, trigger: triggerSave } = useAutoSave(saveFn, 1000);

  const set = (key, val) => {
    const updated = { ...form, [key]: val };
    setForm(updated);
    triggerSave(updated);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('cover_image', file_url);
      toast.success('Thumbnail uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">

      {/* Save status */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Course Details
        </h2>
        <SaveStatus status={saveStatus} lastSaved={lastSaved} />
      </div>

      {/* Course name */}
      <div>
        <Label className="text-xs">Course Name</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. MSCE Biology Book 4" className="mt-1" />
      </div>

      {/* Description */}
      <div>
        <Label className="text-xs">Description</Label>
        <div className="mt-1 rounded-xl overflow-hidden border border-border">
          <ReactQuill
            theme="snow"
            value={form.description || ''}
            onChange={v => set('description', v)}
            modules={{ toolbar: [['bold', 'italic'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] }}
            style={{ minHeight: 100 }}
          />
        </div>
      </div>

      {/* Thumbnail */}
      <div>
        <Label className="text-xs">Course Thumbnail</Label>
        {form.cover_image && (
          <div className="mt-2 relative rounded-xl overflow-hidden h-36 bg-muted border border-border">
            <img src={form.cover_image} alt="thumbnail" className="w-full h-full object-cover" />
            <button onClick={() => set('cover_image', '')}
              className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <Input value={form.cover_image} onChange={e => set('cover_image', e.target.value)}
              placeholder="Paste image URL…" className="flex-1 text-sm" />
          </div>
          <label className="block">
            <input type="file" accept="image/*,video/*" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
            <div className={`flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm text-muted-foreground ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload image or intro video'}
            </div>
          </label>
          <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, MP4 supported</p>
        </div>
      </div>

      {/* Tutor assignment */}
      <div>
        <Label className="text-xs">Assigned Tutor</Label>
        {isAdmin ? (
          <Select value={form.teacher_id} onValueChange={v => {
            const t = tutors.find(t => t.id === v);
            set('teacher_id', v);
            set('teacher_name', t?.full_name || '');
          }}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a tutor" />
            </SelectTrigger>
            <SelectContent>
              {tutors.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                      {t.full_name?.[0]?.toUpperCase()}
                    </div>
                    {t.full_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-xl">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm">{user?.full_name}</span>
            <Badge className="ml-auto text-[9px]">You</Badge>
          </div>
        )}
      </div>

      {/* Access mode */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
        <div>
          <p className="text-sm font-medium">Premium Course</p>
          <p className="text-xs text-muted-foreground">Requires active subscription</p>
        </div>
        <Switch checked={!!form.is_premium} onCheckedChange={v => set('is_premium', v)} />
      </div>

      {/* Status */}
      <div>
        <Label className="text-xs">Course Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">
              <div className="flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" /> Draft</div>
            </SelectItem>
            <SelectItem value="published">
              <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-green-500" /> Published</div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── COURSE STATS BAR ─────────────────────────────────────────────────────────
function CourseStats({ topics, lessons }) {
  const totalMinutes = lessons.reduce((acc, l) => acc + (l.estimated_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {topics.length} topics</span>
      <span className="flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" /> {lessons.length} lessons</span>
      {totalMinutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {durationStr} total</span>}
    </div>
  );
}

// ─── TOPIC DIALOG ─────────────────────────────────────────────────────────────
function TopicDialog({ open, onOpenChange, topic, subjectId, formId }) {
  const qc = useQueryClient();
  const [data, setData] = useState({ title: '', description: '', order: 0 });

  useEffect(() => {
    if (topic) setData({ title: topic.title, description: topic.description || '', order: topic.order || 0 });
    else setData({ title: '', description: '', order: 0 });
  }, [topic, open]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (topic) return base44.entities.Topic.update(topic.id, data);
      return base44.entities.Topic.create({ ...data, subject_id: subjectId, form_id: formId, status: 'published' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', subjectId] });
      toast.success(topic ? 'Topic updated' : 'Topic added');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to save topic'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{topic ? 'Edit Topic' : 'Add Topic'}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Topic Name *</Label>
            <Input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Photosynthesis" className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))}
              placeholder="Optional description" className="mt-1" />
          </div>
          <div>
            <Label>Order</Label>
            <Input type="number" value={data.order} onChange={e => setData(d => ({ ...d, order: parseInt(e.target.value) || 0 }))}
              className="mt-1" min={0} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !data.title} className="flex-1">
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {topic ? 'Update' : 'Add Topic'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN COURSE BUILDER ──────────────────────────────────────────────────────
export default function CourseBuilder() {
  const { subjectId } = useParams();
  const { user } = useOutletContext() ?? {};
  const qc = useQueryClient();

  const [activeView, setActiveView] = useState('curriculum'); // curriculum | details
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [topicDialog, setTopicDialog] = useState({ open: false, topic: null });

  // ── Data fetching ──
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
    queryFn: () => base44.entities.Lesson.filter({ subject_id: subjectId }, 'order', 500),
    refetchInterval: selectedLesson ? false : 10000,
  });

  const { data: tutors = [] } = useQuery({
    queryKey: ['tutorProfiles'],
    queryFn: () => base44.entities.TutorProfile.filter({ status: 'approved' }, 'full_name', 100),
    enabled: user?.role === 'admin',
  });

  // ── Add lesson mutation ──
  const addLessonMut = useMutation({
    mutationFn: async ({ topicId, topicTitle }) => {
      const topicLessons = lessons.filter(l => l.topic_id === topicId);
      return base44.entities.Lesson.create({
        title: 'New Lesson',
        topic_id: topicId,
        topic_title: topicTitle,
        subject_id: subjectId,
        subject_name: subject?.name || '',
        form_id: subject?.form_id || '',
        order: topicLessons.length,
        status: 'draft',
        video_provider: 'none',
        estimated_minutes: 15,
      });
    },
    onSuccess: (newLesson) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      setSelectedLesson(newLesson);
      toast.success('Lesson added');
    },
  });

  const deleteLessonMut = useMutation({
    mutationFn: (id) => base44.entities.Lesson.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      if (selectedLesson?.id === id) setSelectedLesson(null);
      toast.success('Lesson deleted');
    },
  });

  const duplicateLessonMut = useMutation({
    mutationFn: async (lesson) => {
      const { id, created_date, updated_date, created_by_id, created_by, ...rest } = lesson;
      return base44.entities.Lesson.create({ ...rest, title: `${rest.title} (Copy)`, status: 'draft' });
    },
    onSuccess: (newLesson) => {
      qc.invalidateQueries({ queryKey: ['lessons', subjectId] });
      setSelectedLesson(newLesson);
      toast.success('Lesson duplicated');
    },
  });

  const deleteTopicMut = useMutation({
    mutationFn: (id) => base44.entities.Topic.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics', subjectId] });
      toast.success('Topic deleted');
    },
  });

  if (!subject) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-4 -mb-4">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0">
        <Link to={user?.role === 'admin' ? '/admin/curriculum' : '/teacher/courses'}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-sm truncate">{subject.name}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{subject.form_name}</span>
            <CourseStats topics={topics} lessons={lessons} />
          </div>
        </div>

        {/* View toggle: Curriculum / Details */}
        <div className="flex items-center bg-muted rounded-xl p-0.5 gap-0.5">
          <button onClick={() => setActiveView('curriculum')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'curriculum' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Layers className="w-3.5 h-3.5 inline mr-1" />Curriculum
          </button>
          <button onClick={() => setActiveView('details')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === 'details' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Settings className="w-3.5 h-3.5 inline mr-1" />Details
          </button>
        </div>

        {/* Status badge */}
        <Badge className={subject.status === 'published' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-muted text-muted-foreground'}>
          {subject.status === 'published' ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
          {subject.status}
        </Badge>
      </div>

      {/* ── Main content ── */}
      {activeView === 'details' ? (
        /* ── DETAILS VIEW (full width) ── */
        <div className="flex-1 overflow-hidden">
          <CourseDetailsPanel
            subject={subject}
            tutors={tutors}
            user={user}
            onSaved={() => qc.invalidateQueries({ queryKey: ['subject', subjectId] })}
          />
        </div>
      ) : (
        /* ── CURRICULUM SPLIT-SCREEN VIEW ── */
        <div className="flex-1 flex overflow-hidden">

          {/* Left panel — Curriculum Tree */}
          <div className="w-64 flex-shrink-0 border-r border-border bg-background overflow-hidden flex flex-col">
            <CurriculumTree
              topics={topics}
              lessons={lessons}
              selectedLessonId={selectedLesson?.id}
              onSelectLesson={setSelectedLesson}
              onAddTopic={() => setTopicDialog({ open: true, topic: null })}
              onEditTopic={(t) => setTopicDialog({ open: true, topic: t })}
              onDeleteTopic={(id) => deleteTopicMut.mutate(id)}
              onAddLesson={(topic) => addLessonMut.mutate({ topicId: topic.id, topicTitle: topic.title })}
              onDeleteLesson={(id) => deleteLessonMut.mutate(id)}
              onDuplicateLesson={(l) => duplicateLessonMut.mutate(l)}
              subjectId={subjectId}
            />
          </div>

          {/* Right panel — Lesson Editor */}
          <div className="flex-1 overflow-hidden bg-background">
            {selectedLesson ? (
              <LessonEditor
                key={selectedLesson.id}
                lesson={selectedLesson}
                subjectId={subjectId}
                subjectName={subject.name}
                onSaved={() => qc.invalidateQueries({ queryKey: ['lessons', subjectId] })}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Select a lesson to edit</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any lesson in the curriculum tree, or add a new one</p>
                </div>
                {topics.length > 0 && (
                  <Button size="sm" variant="outline"
                    onClick={() => addLessonMut.mutate({ topicId: topics[0].id, topicTitle: topics[0].title })}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Lesson
                  </Button>
                )}
                {topics.length === 0 && (
                  <Button size="sm" onClick={() => setTopicDialog({ open: true, topic: null })}
                    style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Topic
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic dialog */}
      <TopicDialog
        open={topicDialog.open}
        onOpenChange={(v) => setTopicDialog(d => ({ ...d, open: v }))}
        topic={topicDialog.topic}
        subjectId={subjectId}
        formId={subject?.form_id}
      />
    </div>
  );
}

