import React, { useState, useEffect } from 'react';
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
  GraduationCap, User, Globe, Phone, Award, Briefcase,
  Plus, X, Save, ExternalLink, Eye, CheckCircle, Loader2,
  Facebook, Linkedin, Youtube, Twitter, Link as LinkIcon
} from 'lucide-react';
import { toast } from 'sonner';

const ALL_SUBJECTS = [
  'Biology','Chemistry','Physics','Mathematics','Additional Mathematics',
  'English Language','English Literature','Chichewa','Agriculture','Geography','History'
];

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export default function MyTutorProfile() {
  const { user } = useOutletContext();
  const qc = useQueryClient();

  // Load existing profile for this tutor
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['my-tutor-profile', user?.id],
    queryFn: () => base44.entities.TutorProfile.filter({ user_id: user.id }, 'full_name', 1),
    enabled: !!user?.id,
  });
  const profile = profiles[0] || null;

  const [form, setForm] = useState({
    full_name: '', slug: '', professional_title: '', tagline: '',
    biography: '', years_teaching: '', previous_schools: '', current_position: '',
    profile_photo: '', subjects: [],
    qualifications: [], certifications: [],
    email: '', phone: '', whatsapp: '',
    facebook: '', linkedin: '', youtube: '', twitter_x: '', tiktok: '',
    is_visible: true,
  });

  const [qualInput, setQualInput] = useState({ name: '', institution: '', year: '' });
  const [certInput, setCertInput] = useState({ name: '', organization: '', date_issued: '' });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        slug: profile.slug || '',
        professional_title: profile.professional_title || '',
        tagline: profile.tagline || '',
        biography: profile.biography || '',
        years_teaching: profile.years_teaching || '',
        previous_schools: profile.previous_schools || '',
        current_position: profile.current_position || '',
        profile_photo: profile.profile_photo || '',
        subjects: profile.subjects || [],
        qualifications: profile.qualifications || [],
        certifications: profile.certifications || [],
        email: profile.email || '',
        phone: profile.phone || '',
        whatsapp: profile.whatsapp || '',
        facebook: profile.facebook || '',
        linkedin: profile.linkedin || '',
        youtube: profile.youtube || '',
        twitter_x: profile.twitter_x || '',
        tiktok: profile.tiktok || '',
        is_visible: profile.is_visible !== false,
      });
    } else if (user) {
      setForm(f => ({
        ...f,
        full_name: user.full_name || '',
        slug: slugify(user.full_name || ''),
        email: user.email || '',
      }));
    }
  }, [profile, user]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleSubject = s => set('subjects', form.subjects.includes(s) ? form.subjects.filter(x => x !== s) : [...form.subjects, s]);

  const addQual = () => {
    if (!qualInput.name) return;
    set('qualifications', [...form.qualifications, { ...qualInput }]);
    setQualInput({ name: '', institution: '', year: '' });
  };
  const addCert = () => {
    if (!certInput.name) return;
    set('certifications', [...form.certifications, { ...certInput }]);
    setCertInput({ name: '', organization: '', date_issued: '' });
  };

  const saveMut = useMutation({
    mutationFn: async (data) => {
      if (profile?.id) {
        return base44.entities.TutorProfile.update(profile.id, data);
      } else {
        return base44.entities.TutorProfile.create({ ...data, user_id: user.id, status: 'active' });
      }
    },
    onSuccess: () => {
      toast.success('Profile saved!');
      qc.invalidateQueries(['my-tutor-profile', user?.id]);
    },
    onError: e => toast.error('Save failed: ' + e.message),
  });

  const handleSave = () => {
    if (!form.full_name || !form.slug) { toast.error('Name and slug are required'); return; }
    saveMut.mutate({
      ...form,
      years_teaching: form.years_teaching ? Number(form.years_teaching) : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-primary" style={{animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Public Profile" description="Manage your public tutor profile on Chibondo Academy" />
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">My Public Profile</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              This is what students see when they browse tutors
            </p>
          </div>
          <div className="flex gap-2">
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
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </div>

        {/* Visibility banner */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${form.is_visible ? 'bg-success/5 border-success/20' : 'bg-muted border-border'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${form.is_visible ? 'bg-success' : 'bg-muted-foreground'}`} />
            <span className="text-sm font-medium">
              {form.is_visible ? 'Your profile is visible to students' : 'Your profile is hidden from the directory'}
            </span>
          </div>
          <button
            onClick={() => set('is_visible', !form.is_visible)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.is_visible ? 'border-success/30 text-success hover:bg-success/10' : 'border-border text-muted-foreground hover:border-primary/40'}`}
          >
            {form.is_visible ? 'Hide profile' : 'Make visible'}
          </button>
        </div>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="basic" className="gap-1.5"><User className="w-3.5 h-3.5"/>Basic Info</TabsTrigger>
            <TabsTrigger value="qualifications" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5"/>Qualifications</TabsTrigger>
            <TabsTrigger value="experience" className="gap-1.5"><Briefcase className="w-3.5 h-3.5"/>Experience</TabsTrigger>
            <TabsTrigger value="contact" className="gap-1.5"><Globe className="w-3.5 h-3.5"/>Contact & Social</TabsTrigger>
          </TabsList>

          {/* ── BASIC INFO ── */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={e => { set('full_name', e.target.value); if (!profile) set('slug', slugify(e.target.value)); }} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Profile URL Slug *</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">/tutors/</span>
                    <Input value={form.slug} onChange={e => set('slug', slugify(e.target.value))} className="font-mono text-sm" />
                  </div>
                  {form.slug && <p className="text-xs text-primary/70 mt-1">aca.base44.app/tutors/{form.slug}</p>}
                </div>
                <div className="col-span-2">
                  <Label>Professional Title</Label>
                  <Input value={form.professional_title} onChange={e => set('professional_title', e.target.value)} className="mt-1" placeholder="e.g. Senior Biology Tutor" />
                </div>
                <div className="col-span-2">
                  <Label>Tagline</Label>
                  <Input value={form.tagline} onChange={e => set('tagline', e.target.value)} className="mt-1" placeholder="e.g. Making Science Simple" maxLength={100} />
                </div>
                <div className="col-span-2">
                  <Label>Profile Photo URL</Label>
                  <Input value={form.profile_photo} onChange={e => set('profile_photo', e.target.value)} className="mt-1" placeholder="https://..." />
                  {form.profile_photo && (
                    <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-border">
                      <img src={form.profile_photo} alt="Preview" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Biography</Label>
                <Textarea value={form.biography} onChange={e => set('biography', e.target.value)} rows={6} className="mt-1" placeholder="Tell students about yourself — your background, teaching philosophy, and what makes you passionate about education..." />
                <p className="text-xs text-muted-foreground mt-1">Supports basic HTML for formatting</p>
              </div>

              <div>
                <Label className="mb-2 block">Subjects You Teach</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SUBJECTS.map(s => (
                    <button type="button" key={s} onClick={() => toggleSubject(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.subjects.includes(s)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── QUALIFICATIONS ── */}
          <TabsContent value="qualifications" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold">Academic Qualifications</h3>
              {form.qualifications.map((q, i) => (
                <div key={i} className="flex items-start justify-between gap-3 bg-muted/30 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium">{q.name}</p>
                    <p className="text-xs text-muted-foreground">{q.institution} {q.year && `· ${q.year}`}</p>
                  </div>
                  <button onClick={() => set('qualifications', form.qualifications.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-7 gap-2 items-end">
                <div className="col-span-3">
                  <Label className="text-xs">Qualification</Label>
                  <Input value={qualInput.name} onChange={e=>setQualInput(p=>({...p,name:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="e.g. BSc Biology" />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Institution</Label>
                  <Input value={qualInput.institution} onChange={e=>setQualInput(p=>({...p,institution:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="University name" />
                </div>
                <div className="col-span-1 flex gap-1">
                  <div className="flex-1">
                    <Label className="text-xs">Year</Label>
                    <Input value={qualInput.year} onChange={e=>setQualInput(p=>({...p,year:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="2024" />
                  </div>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addQual} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Qualification
              </Button>

              <div className="border-t border-border pt-4">
                <h3 className="font-semibold mb-3">Professional Certifications</h3>
                {form.certifications.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 bg-muted/30 rounded-xl p-3 mb-2">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.organization} {c.date_issued && `· ${c.date_issued}`}</p>
                    </div>
                    <button onClick={() => set('certifications', form.certifications.filter((_,j)=>j!==i))} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Certificate</Label>
                    <Input value={certInput.name} onChange={e=>setCertInput(p=>({...p,name:e.target.value}))} className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Organization</Label>
                    <Input value={certInput.organization} onChange={e=>setCertInput(p=>({...p,organization:e.target.value}))} className="mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Date Issued</Label>
                    <Input value={certInput.date_issued} onChange={e=>setCertInput(p=>({...p,date_issued:e.target.value}))} className="mt-1 h-9 text-sm" placeholder="Jan 2024" />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCert} className="w-full mt-2">
                  <Plus className="w-4 h-4 mr-2" /> Add Certification
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── EXPERIENCE ── */}
          <TabsContent value="experience" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Years Teaching</Label>
                  <Input type="number" min={0} value={form.years_teaching} onChange={e=>set('years_teaching',e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Current Position</Label>
                  <Input value={form.current_position} onChange={e=>set('current_position',e.target.value)} className="mt-1" placeholder="e.g. Tutor at Chibondo Academy" />
                </div>
                <div className="col-span-2">
                  <Label>Previous Schools / Institutions</Label>
                  <Textarea value={form.previous_schools} onChange={e=>set('previous_schools',e.target.value)} rows={3} className="mt-1" placeholder="List schools or institutions you've taught at..." />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── CONTACT & SOCIAL ── */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold">Contact Info <span className="text-xs font-normal text-muted-foreground">(optional — shown on your public profile)</span></h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className="mt-1" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e=>set('phone',e.target.value)} className="mt-1" /></div>
                <div className="col-span-2"><Label>WhatsApp Number</Label><Input value={form.whatsapp} onChange={e=>set('whatsapp',e.target.value)} className="mt-1" placeholder="+265..." /></div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-semibold">Social Links</h3>
                {[
                  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourpage' },
                  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/yourname' },
                  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourchannel' },
                  { key: 'twitter_x', label: 'X / Twitter', icon: Twitter, placeholder: 'https://x.com/yourhandle' },
                  { key: 'tiktok', label: 'TikTok', icon: LinkIcon, placeholder: 'https://tiktok.com/@yourhandle' },
                ].map(({ key, label, icon: Icon, placeholder }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className="text-sm" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save button at bottom */}
        <div className="flex justify-end gap-3 pb-8">
          {profile?.slug && (
            <a href={`/tutors/${profile.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:border-primary/40 transition-colors">
              <ExternalLink className="w-4 h-4" /> View Live Profile
            </a>
          )}
          <Button onClick={handleSave} disabled={saveMut.isPending} size="lg">
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Save Profile
          </Button>
        </div>
      </div>
    </>
  );
}
