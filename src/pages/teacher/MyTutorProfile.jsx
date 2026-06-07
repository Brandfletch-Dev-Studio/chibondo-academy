import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SEO from '@/components/SEO';
import {
  GraduationCap, User, Globe, Briefcase,
  Plus, X, Save, ExternalLink, Eye, CheckCircle, Loader2,
  Facebook, Linkedin, Youtube, Twitter, Link as LinkIcon,
  Camera, Upload, AlertCircle, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

const ALL_SUBJECTS = [
  'Biology','Chemistry','Physics','Mathematics','Additional Mathematics',
  'English Language','English Literature','Chichewa','Agriculture','Geography','History'
];

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// ── Photo Uploader ────────────────────────────────────────────────────────────


function PhotoUploader({ value, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  // localPreview shows the image immediately from the local File object
  // so the user sees their pick BEFORE the upload completes
  const [localPreview, setLocalPreview] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    // Show local preview instantly
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);

    setUploading(true);
    try {
      // Use FormData — the correct way to upload via fetch to Base44 storage
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`/api/apps/${import.meta.env.VITE_APP_ID || window.__appParams?.appId || ''}/storage/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${window.__appParams?.token || ''}` },
        body: formData,
      });
      if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
      const json = await resp.json();
      const url = json.url || json.file_url || json.public_url || objectUrl;
      onChange(url);
      toast.success('Photo uploaded!');
    } catch (err) {
      // Keep showing the local preview even if upload failed
      // user can retry; we still call onChange with the objectUrl as fallback
      toast.error('Upload error — photo shown locally. Try saving again.');
      onChange(objectUrl);
    } finally {
      setUploading(false);
    }
  };

  // The image to display: local preview (instant) → saved URL → nothing
  const displaySrc = localPreview || value || null;

  return (
    <div className="flex items-center gap-4">
      {/* Preview circle */}
      <div
        className="relative flex-shrink-0 cursor-pointer group"
        onClick={() => inputRef.current?.click()}
      >
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-border bg-muted flex items-center justify-center shadow-sm">
          {displaySrc ? (
            <img src={displaySrc} alt="Profile photo" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Camera className="w-7 h-7" />
              <span className="text-[10px] font-medium">Add Photo</span>
            </div>
          )}
        </div>
        {/* Overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Camera className="w-5 h-5 text-white" />
          }
        </div>
        {/* Uploading ring */}
        {uploading && (
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : displaySrc ? 'Change Photo' : 'Upload Photo'}
        </Button>
        {displaySrc && !uploading && (
          <button
            type="button"
            onClick={() => { setLocalPreview(null); onChange(''); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left"
          >
            Remove photo
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP · max 5 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
        // Reset value so selecting same file triggers onChange again
        onClick={e => { e.target.value = ''; }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MyTutorProfile() {
  const { user } = useOutletContext();
  const qc = useQueryClient();
  const [saveError, setSaveError] = useState(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['my-tutor-profile', user?.id],
    queryFn: () => base44.entities.TutorProfile.filter({ user_id: user.id }, 'full_name', 1),
    enabled: !!user?.id,
    staleTime: 0,
  });
  const profile = profiles[0] || null;

  const EMPTY = {
    full_name: '', slug: '', professional_title: '', tagline: '',
    biography: '', years_teaching: '', previous_schools: '', current_position: '',
    profile_photo: '', subjects: [],
    qualifications: [], certifications: [],
    email: '', phone: '', whatsapp: '',
    facebook: '', linkedin: '', youtube: '', twitter_x: '', tiktok: '',
    is_visible: true,
  };

  const [form, setForm] = useState(EMPTY);
  const [qualInput, setQualInput] = useState({ name: '', institution: '', year: '' });
  const [certInput, setCertInput] = useState({ name: '', organization: '', date_issued: '' });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name:          profile.full_name          || '',
        slug:               profile.slug               || '',
        professional_title: profile.professional_title || '',
        tagline:            profile.tagline            || '',
        biography:          profile.biography          || '',
        years_teaching:     profile.years_teaching     || '',
        previous_schools:   profile.previous_schools   || '',
        current_position:   profile.current_position   || '',
        profile_photo:      profile.profile_photo      || '',
        subjects:           profile.subjects           || [],
        qualifications:     profile.qualifications     || [],
        certifications:     profile.certifications     || [],
        email:              profile.email              || '',
        phone:              profile.phone              || '',
        whatsapp:           profile.whatsapp           || '',
        facebook:           profile.facebook           || '',
        linkedin:           profile.linkedin           || '',
        youtube:            profile.youtube            || '',
        twitter_x:          profile.twitter_x          || '',
        tiktok:             profile.tiktok             || '',
        is_visible:         profile.is_visible !== false,
      });
    } else if (user && !profile) {
      setForm(f => ({
        ...f,
        full_name: user.full_name || '',
        slug:      slugify(user.full_name || ''),
        email:     user.email || '',
      }));
    }
  }, [profile?.id, user?.id]); // only re-run when IDs change, not on every render

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleSubject = s => set('subjects', form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);

  const addQual = () => {
    if (!qualInput.name.trim()) return;
    set('qualifications', [...(form.qualifications || []), { ...qualInput }]);
    setQualInput({ name: '', institution: '', year: '' });
  };
  const addCert = () => {
    if (!certInput.name.trim()) return;
    set('certifications', [...(form.certifications || []), { ...certInput }]);
    setCertInput({ name: '', organization: '', date_issued: '' });
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    if (!form.slug.trim())      { toast.error('Profile slug is required'); return; }

    setSaveError(null);
    setIsSaving(true);

    const payload = {
      ...form,
      years_teaching: form.years_teaching !== '' ? Number(form.years_teaching) : null,
      user_id: user.id,
      status: 'active',
    };

    try {
      if (profile?.id) {
        await base44.entities.TutorProfile.update(profile.id, payload);
      } else {
        await base44.entities.TutorProfile.create(payload);
      }
      toast.success('Profile saved successfully!');
      // Refetch so profile.id is available next save
      await qc.invalidateQueries({ queryKey: ['my-tutor-profile', user?.id] });
    } catch (err) {
      const msg = err?.message || String(err);
      setSaveError(msg);
      toast.error('Save failed: ' + msg);
      console.error('TutorProfile save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary" style={{animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}} />)}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Public Profile" description="Manage your public tutor profile on Chibondo Academy" />
      <div className="max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">My Public Profile</h1>
            <p className="text-sm text-muted-foreground mt-0.5">This is what students see when they browse tutors</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {profile?.slug && (
              <a
                href={`/tutors/${profile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:border-primary/40 transition-colors"
              >
                <Eye className="w-4 h-4" /> Preview
              </a>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Status banner */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${form.is_visible ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted border-border'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${form.is_visible ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            <span className="text-sm font-medium">
              {form.is_visible ? 'Visible to students in the tutor directory' : 'Hidden from the tutor directory'}
            </span>
          </div>
          <button
            onClick={() => set('is_visible', !form.is_visible)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.is_visible ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10' : 'border-border text-muted-foreground hover:border-primary/40'}`}
          >
            {form.is_visible ? 'Hide' : 'Make visible'}
          </button>
        </div>

        <Tabs defaultValue="basic">
          <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="basic"           className="gap-1.5"><User className="w-3.5 h-3.5" />Basic Info</TabsTrigger>
            <TabsTrigger value="qualifications"  className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" />Qualifications</TabsTrigger>
            <TabsTrigger value="experience"      className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Experience</TabsTrigger>
            <TabsTrigger value="contact"         className="gap-1.5"><Globe className="w-3.5 h-3.5" />Contact & Social</TabsTrigger>
          </TabsList>

          {/* ── BASIC INFO ── */}
          <TabsContent value="basic" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

              {/* Profile photo */}
              <div>
                <Label className="mb-2 block">Profile Photo</Label>
                <PhotoUploader value={form.profile_photo} onChange={v => set('profile_photo', v)} />

              <div className="mt-4">
                <Label className="mb-2 block">
                  Cover Photo{' '}
                  <span className="text-[10px] font-normal text-muted-foreground/60 normal-case">(wide banner on your profile page)</span>
                </Label>
                <CoverUploader value={form.cover_photo} onChange={v => set('cover_photo', v)} />
              </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => {
                      set('full_name', e.target.value);
                      if (!profile) set('slug', slugify(e.target.value));
                    }}
                    className="mt-1"
                    placeholder="Your full name"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Profile URL *</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-2 rounded-l-xl border border-r-0 border-border">/tutors/</span>
                    <Input
                      value={form.slug}
                      onChange={e => set('slug', slugify(e.target.value))}
                      className="rounded-l-none font-mono text-sm"
                      placeholder="your-name"
                    />
                  </div>
                  {form.slug && (
                    <p className="text-xs text-primary/70 mt-1">Live at: aca.base44.app/tutors/{form.slug}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <Label>Professional Title</Label>
                  <Input value={form.professional_title} onChange={e => set('professional_title', e.target.value)} className="mt-1" placeholder="e.g. Senior Biology Tutor" />
                </div>

                <div className="col-span-2">
                  <Label>Tagline <span className="text-xs text-muted-foreground font-normal">(shown on your card)</span></Label>
                  <Input value={form.tagline} onChange={e => set('tagline', e.target.value)} className="mt-1" placeholder="e.g. Making Science Simple" maxLength={100} />
                </div>
              </div>

              <div>
                <Label>Biography</Label>
                <Textarea
                  value={form.biography}
                  onChange={e => set('biography', e.target.value)}
                  rows={6}
                  className="mt-1"
                  placeholder="Tell students about yourself — your background, teaching philosophy, and what makes you passionate about education..."
                />
                <p className="text-xs text-muted-foreground mt-1">Supports basic HTML tags for formatting</p>
              </div>

              <div>
                <Label className="mb-3 block">Subjects You Teach</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SUBJECTS.map(s => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSubject(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.subjects.includes(s)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── QUALIFICATIONS ── */}
          <TabsContent value="qualifications" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="font-semibold mb-3">Academic Qualifications</h3>
                <div className="space-y-2 mb-4">
                  {(form.qualifications || []).map((q, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 bg-muted/40 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-medium">{q.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.institution}{q.year && ` · ${q.year}`}</p>
                      </div>
                      <button onClick={() => set('qualifications', form.qualifications.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs">Qualification</Label>
                    <Input value={qualInput.name} onChange={e=>setQualInput(p=>({...p,name:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="e.g. BSc Biology" onKeyDown={e=>e.key==='Enter'&&addQual()} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Institution</Label>
                    <Input value={qualInput.institution} onChange={e=>setQualInput(p=>({...p,institution:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="University" onKeyDown={e=>e.key==='Enter'&&addQual()} />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Year</Label>
                    <Input value={qualInput.year} onChange={e=>setQualInput(p=>({...p,year:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="2024" onKeyDown={e=>e.key==='Enter'&&addQual()} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" size="sm" variant="outline" onClick={addQual} className="w-full h-9"><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h3 className="font-semibold mb-3">Professional Certifications</h3>
                <div className="space-y-2 mb-4">
                  {(form.certifications || []).map((c, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 bg-muted/40 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.organization}{c.date_issued && ` · ${c.date_issued}`}</p>
                      </div>
                      <button onClick={() => set('certifications', form.certifications.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Certificate</Label>
                    <Input value={certInput.name} onChange={e=>setCertInput(p=>({...p,name:e.target.value}))} className="mt-1 h-9 text-sm" onKeyDown={e=>e.key==='Enter'&&addCert()} />
                  </div>
                  <div>
                    <Label className="text-xs">Organization</Label>
                    <Input value={certInput.organization} onChange={e=>setCertInput(p=>({...p,organization:e.target.value}))} className="mt-1 h-9 text-sm" onKeyDown={e=>e.key==='Enter'&&addCert()} />
                  </div>
                  <div>
                    <Label className="text-xs">Date Issued</Label>
                    <Input value={certInput.date_issued} onChange={e=>setCertInput(p=>({...p,date_issued:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="Jan 2024" onKeyDown={e=>e.key==='Enter'&&addCert()} />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCert} className="w-full mt-2 gap-2">
                  <Plus className="w-4 h-4" /> Add Certification
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── EXPERIENCE ── */}
          <TabsContent value="experience" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Years Teaching</Label>
                  <Input type="number" min={0} value={form.years_teaching} onChange={e=>set('years_teaching',e.target.value)} className="mt-1" placeholder="0" />
                </div>
                <div>
                  <Label>Current Position</Label>
                  <Input value={form.current_position} onChange={e=>set('current_position',e.target.value)} className="mt-1" placeholder="e.g. Tutor at Chibondo Academy" />
                </div>
                <div className="col-span-2">
                  <Label>Previous Schools / Institutions</Label>
                  <Textarea value={form.previous_schools} onChange={e=>set('previous_schools',e.target.value)} rows={3} className="mt-1" placeholder="List schools or institutions you've taught at previously..." />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── CONTACT & SOCIAL ── */}
          <TabsContent value="contact" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="font-semibold mb-1">Contact Info</h3>
                <p className="text-xs text-muted-foreground mb-4">Optional — only shown if you choose to include it</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className="mt-1" /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e=>set('phone',e.target.value)} className="mt-1" /></div>
                  <div className="col-span-2"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e=>set('whatsapp',e.target.value)} className="mt-1" placeholder="+265 99 000 0000" /></div>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h3 className="font-semibold mb-4">Social Links</h3>
                <div className="space-y-3">
                  {[
                    { key:'facebook',  label:'Facebook',   icon:Facebook,  placeholder:'https://facebook.com/yourpage' },
                    { key:'linkedin',  label:'LinkedIn',   icon:Linkedin,  placeholder:'https://linkedin.com/in/yourname' },
                    { key:'youtube',   label:'YouTube',    icon:Youtube,   placeholder:'https://youtube.com/@yourchannel' },
                    { key:'twitter_x', label:'X / Twitter',icon:Twitter,   placeholder:'https://x.com/yourhandle' },
                    { key:'tiktok',    label:'TikTok',     icon:LinkIcon,  placeholder:'https://tiktok.com/@yourhandle' },
                  ].map(({ key, label, icon: Icon, placeholder }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className="mt-0.5 text-sm h-9" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom save */}
        <div className="flex justify-end gap-3 pb-8">
          {profile?.slug && (
            <a
              href={`/tutors/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:border-primary/40 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> View Live Profile
            </a>
          )}
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </>
  );
}
