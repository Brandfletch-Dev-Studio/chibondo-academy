import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, BookOpen, FileText, Lightbulb, GraduationCap, ClipboardList, Library, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

const TYPE_CONFIG = {
  past_paper:      { label: 'Past Paper',      icon: FileText,      color: 'bg-primary/10 text-primary border-primary/20' },
  model_answer:    { label: 'Model Answer',    icon: ClipboardList, color: 'bg-success/10 text-success border-success/20' },
  revision_notes:  { label: 'Revision Notes',  icon: BookOpen,      color: 'bg-accent/10 text-accent-foreground border-accent/20' },
  exam_tips:       { label: 'Exam Tips',       icon: Lightbulb,     color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  mock_exam:       { label: 'Mock Exam',       icon: GraduationCap, color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const TYPE_ICON_BG = {
  past_paper:      'bg-primary/10 text-primary',
  model_answer:    'bg-success/10 text-success',
  revision_notes:  'bg-accent/20 text-accent-foreground',
  exam_tips:       'bg-yellow-500/10 text-yellow-700',
  mock_exam:       'bg-destructive/10 text-destructive',
};

export default function LibraryPage() {
  const ctx = useOutletContext() ?? {};
  const { user } = ctx;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formFilter, setFormFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['library-resources'],
    queryFn: () => base44.entities.RevisionResource.filter({ status: 'published' }, '-created_date', 300),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => base44.entities.AcademicForm.filter({ status: 'active' }, 'order', 50),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => base44.entities.Subscription.filter({ student_id: user.id, status: 'active' }, '-created_date', 1),
    enabled: !!user?.id,
    select: data => data[0] || null,
  });

  const hasPaidFees = !!subscription;

  // Unique subjects from resources
  const subjects = [...new Set(resources.map(r => r.subject_name).filter(Boolean))].sort();

  const filtered = resources.filter(r => {
    const matchType    = typeFilter    === 'all' || r.type        === typeFilter;
    const matchForm    = formFilter    === 'all' || r.form_id     === formFilter;
    const matchSubject = subjectFilter === 'all' || r.subject_name === subjectFilter;
    const matchSearch  = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
                         (r.description || '').toLowerCase().includes(search.toLowerCase()) ||
                         (r.subject_name || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchForm && matchSubject && matchSearch;
  });

  // Group by form → subject
  const grouped = {};
  filtered.forEach(r => {
    const formKey    = r.form_name    || 'General';
    const subjectKey = r.subject_name || 'General';
    if (!grouped[formKey]) grouped[formKey] = {};
    if (!grouped[formKey][subjectKey]) grouped[formKey][subjectKey] = [];
    grouped[formKey][subjectKey].push(r);
  });

  const sortedForms = Object.keys(grouped).sort();

  const stats = [
    { label: 'Total Resources', value: resources.length, icon: Library, color: 'text-primary' },
    { label: 'Past Papers', value: resources.filter(r => r.type === 'past_paper').length, icon: FileText, color: 'text-primary' },
    { label: 'Revision Notes', value: resources.filter(r => r.type === 'revision_notes').length, icon: BookOpen, color: 'text-success' },
    { label: 'Mock Exams', value: resources.filter(r => r.type === 'mock_exam').length, icon: GraduationCap, color: 'text-accent-foreground' },
  ];

  return (
    <>
      <SEO
        title="MSCE Library — Past Papers, Notes & Revision Resources | Chibondo Academy"
        description="Download free MSCE past papers, revision notes, and study resources for Form 3 and Form 4. Biology, Chemistry, Maths, Physics and more."
        canonical={`${window.location.origin}/library`}
        keywords="MSCE past papers, revision notes, Form 3 resources, Form 4 resources, download Malawi"
      />
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Past papers, revision notes, and study materials</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
          <Library className="w-4 h-4 text-primary" />
          <span>{resources.length} resources available</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className={cn('w-5 h-5 mx-auto mb-1.5', color)} />
            <p className="text-xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formFilter} onValueChange={setFormFilter}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All Forms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-card rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Library className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">No resources found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedForms.map(formName => (
            <div key={formName}>
              {/* Form Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-display font-bold">{formName}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {Object.values(grouped[formName]).flat().length} files
                </span>
              </div>

              {/* Subject Groups */}
              <div className="space-y-4 pl-0 sm:pl-2">
                {Object.keys(grouped[formName]).sort().map(subjectName => (
                  <div key={subjectName}>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{subjectName}</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {grouped[formName][subjectName].map(resource => (
                        <ResourceCard key={resource.id} resource={resource} hasPaidFees={hasPaidFees} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function ResourceCard({ resource, hasPaidFees }) {
  const navigate = useNavigate();
  const config = TYPE_CONFIG[resource.type] || { label: resource.type, icon: FileText, color: 'bg-muted text-muted-foreground border-muted' };
  const iconBg  = TYPE_ICON_BG[resource.type]  || 'bg-muted text-muted-foreground';
  const Icon    = config.icon;
  const locked  = resource.is_premium && !hasPaidFees;

  return (
    <div className={cn(
      'group bg-card rounded-xl border transition-all duration-200',
      locked ? 'border-border opacity-70' : 'border-border hover:border-primary/30 hover:shadow-md'
    )}>
      <div className="p-4">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge className={cn('text-[10px] px-2 py-0.5 border', config.color)}>
              {config.label}
            </Badge>
            {resource.year && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{resource.year}</span>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm leading-snug line-clamp-2">{resource.title}</h4>
        {resource.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground truncate max-w-[60%]">
            {[resource.subject_name, resource.form_name].filter(Boolean).join(' · ')}
          </span>
          {locked ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" /> Premium
            </span>
          ) : resource.file_url ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/library/read/${resource.id}`)}
                className="flex items-center gap-1 text-xs font-semibold hover:underline"
                style={{ color: 'hsl(43 74% 52%)' }}
              >
                <Eye className="w-3 h-3" /> Read
              </button>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={resource.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Download className="w-3 h-3" /> Download
              </a>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No file</span>
          )}
        </div>
      </div>
    </div>
  );
}