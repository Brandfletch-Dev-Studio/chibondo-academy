import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  GraduationCap, Plus, Search, MoreVertical, Edit, Archive,
  Eye, EyeOff, ExternalLink, Trash2, Loader2, X, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const ALL_SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Additional Mathematics',
  'English Language', 'English Literature', 'Chichewa', 'Agriculture', 'Geography', 'History'
];

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY_TUTOR = {
  full_name: '', slug: '', professional_title: '', tagline: '',
  biography: '', years_teaching: '', previous_schools: '', current_position: '',
  profile_photo: '', subjects: [],
  qualifications: [], certifications: [],
  email: '', phone: '', whatsapp: '',
  facebook: '', linkedin: '', youtube: '', twitter_x: '', tiktok: '',
  is_visible: true, status: 'active',
};

function TutorForm({ initial, onSave, onClose, isSaving }) {
  const [form, setForm] = useState({ ...EMPTY_TUTOR, ...initial });
  const [qualInput, setQualInput] = useState({ name: '', institution: '', year: '' });
  const [certInput, setCertInput] = useState({ name: '', organization: '', date_issued: '' });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const autoSlug = () => {
    if (!form.slug && form.full_name) set('slug', slugify(form.full_name));
  };

  const toggleSubject = (s) => {
    set('subjects', form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);
  };

  const addQual = () => {
    if (!qualInput.name) return;
    set('qualifications', [...(form.qualifications || []), { ...qualInput }]);
    setQualInput({ name: '', institution: '', year: '' });
  };

  const addCert = () => {
    if (!certInput.name) return;
    set('certifications', [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: '', organization: '', date_issued: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.slug) { toast.error('Full name and slug are required'); return; }
    onSave({
      ...form,
      years_teaching: form.years_teaching ? Number(form.years_teaching) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={e => { set('full_name', e.target.value); }} onBlur={autoSlug} className="mt-1" required />
          </div>
          <div className="col-span-2">
            <Label>Slug (URL) *</Label>
            <Input value={form.slug} onChange={e => set('slug', slugify(e.target.value))} className="mt-1 font-mono text-sm" placeholder="e.g. taonga-chipondo" required />
            <p className="text-xs text-muted-foreground mt-1">Profile URL: /tutors/{form.slug || '...'}</p>
          </div>
          <div className="col-span-2">
            <Label>Professional Title</Label>
            <Input value={form.professional_title} onChange={e => set('professional_title', e.target.value)} className="mt-1" placeholder="e.g. Senior Biology Tutor" />
          </div>
          <div className="col-span-2">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={e => set('tagline', e.target.value)} className="mt-1" placeholder="e.g. Making Science Simple" />
          </div>
          <div className="col-span-2">
            <Label>Profile Photo URL</Label>
            <Input value={form.profile_photo} onChange={e => set('profile_photo', e.target.value)} className="mt-1" placeholder="https://..." />
          </div>
        </div>
      </div>

      {/* Subjects */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subjects</h3>
        <div className="flex flex-wrap gap-2">
          {ALL_SUBJECTS.map(s => (
            <button type="button" key={s} onClick={() => toggleSubject(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                form.subjects.includes(s)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Biography */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Biography</h3>
        <Textarea
          value={form.biography}
          onChange={e => set('biography', e.target.value)}
          rows={5}
          placeholder="Introduction, educational background, teaching philosophy..."
        />
        <p className="text-xs text-muted-foreground mt-1">Supports HTML formatting</p>
      </div>

      {/* Experience */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Experience</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Years Teaching</Label>
            <Input type="number" value={form.years_teaching} onChange={e => set('years_teaching', e.target.value)} className="mt-1" min={0} />
          </div>
          <div>
            <Label>Current Position</Label>
            <Input value={form.current_position} onChange={e => set('current_position', e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Previous Schools / Institutions</Label>
            <Input value={form.previous_schools} onChange={e => set('previous_schools', e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Qualifications */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Qualifications</h3>
        {(form.qualifications || []).map((q, i) => (
          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2 text-sm">
            <span>{q.name} — {q.institution} {q.year && `(${q.year})`}</span>
            <button type="button" onClick={() => set('qualifications', form.qualifications.filter((_, j) => j !== i))}>
              <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Qualification" value={qualInput.name} onChange={e => setQualInput(p => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Institution" value={qualInput.institution} onChange={e => setQualInput(p => ({ ...p, institution: e.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="Year" value={qualInput.year} onChange={e => setQualInput(p => ({ ...p, year: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" onClick={addQual}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Certifications */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Certifications</h3>
        {(form.certifications || []).map((c, i) => (
          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2 text-sm">
            <span>{c.name} — {c.organization}</span>
            <button type="button" onClick={() => set('certifications', form.certifications.filter((_, j) => j !== i))}>
              <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Certificate" value={certInput.name} onChange={e => setCertInput(p => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Organization" value={certInput.organization} onChange={e => setCertInput(p => ({ ...p, organization: e.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="Date" value={certInput.date_issued} onChange={e => setCertInput(p => ({ ...p, date_issued: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" onClick={addCert}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact & Social</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="mt-1" /></div>
          <div><Label>Facebook URL</Label><Input value={form.facebook} onChange={e => set('facebook', e.target.value)} className="mt-1" /></div>
          <div><Label>LinkedIn URL</Label><Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} className="mt-1" /></div>
          <div><Label>YouTube URL</Label><Input value={form.youtube} onChange={e => set('youtube', e.target.value)} className="mt-1" /></div>
          <div><Label>X / Twitter URL</Label><Input value={form.twitter_x} onChange={e => set('twitter_x', e.target.value)} className="mt-1" /></div>
          <div><Label>TikTok URL</Label><Input value={form.tiktok} onChange={e => set('tiktok', e.target.value)} className="mt-1" /></div>
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_visible" checked={form.is_visible} onChange={e => set('is_visible', e.target.checked)} className="w-4 h-4 rounded" />
        <Label htmlFor="is_visible">Visible on public directory</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          {initial?.id ? 'Save Changes' : 'Create Tutor'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function TutorManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['admin-tutors'],
    queryFn: () => base44.entities.TutorProfile.list('full_name', 500),
  });

  const createMut = useMutation({
    mutationFn: data => base44.entities.TutorProfile.create(data),
    onSuccess: () => { toast.success('Tutor created'); qc.invalidateQueries(['admin-tutors']); setDialogOpen(false); },
    onError: e => toast.error('Failed: ' + e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TutorProfile.update(id, data),
    onSuccess: () => { toast.success('Tutor updated'); qc.invalidateQueries(['admin-tutors']); setDialogOpen(false); },
    onError: e => toast.error('Failed: ' + e.message),
  });

  const archiveMut = useMutation({
    mutationFn: id => base44.entities.TutorProfile.update(id, { status: 'archived' }),
    onSuccess: () => { toast.success('Tutor archived'); qc.invalidateQueries(['admin-tutors']); },
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ id, is_visible }) => base44.entities.TutorProfile.update(id, { is_visible }),
    onSuccess: () => qc.invalidateQueries(['admin-tutors']),
  });

  const handleSave = (data) => {
    if (editing?.id) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const filtered = tutors.filter(t =>
    !search ||
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Tutor Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage tutor profiles and public directory</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/tutors"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:border-primary/40 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> View Directory
          </a>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Tutor
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tutors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">No tutors yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Click "Add Tutor" to create the first profile</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tutor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Subjects</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(tutor => (
                  <tr key={tutor.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex-shrink-0 flex items-center justify-center">
                          {tutor.profile_photo ? (
                            <img src={tutor.profile_photo} alt={tutor.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-primary text-sm">{tutor.full_name?.[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{tutor.full_name}</p>
                          <p className="text-xs text-muted-foreground">{tutor.professional_title || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {tutor.subjects?.slice(0, 3).map(s => (
                          <Badge key={s} variant="outline" className="text-[10px] py-0 border-primary/20 text-primary/70">{s}</Badge>
                        ))}
                        {(tutor.subjects?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">+{tutor.subjects.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${tutor.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}>
                          {tutor.status}
                        </Badge>
                        {!tutor.is_visible && <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(tutor); setDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/tutors/${tutor.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" /> View Profile
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleVisibility.mutate({ id: tutor.id, is_visible: !tutor.is_visible })}>
                            {tutor.is_visible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {tutor.is_visible ? 'Hide from directory' : 'Show in directory'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => archiveMut.mutate(tutor.id)}>
                            <Archive className="w-4 h-4 mr-2" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Tutor' : 'Add New Tutor'}</DialogTitle>
          </DialogHeader>
          <TutorForm initial={editing} onSave={handleSave} onClose={() => setDialogOpen(false)} isSaving={isSaving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
