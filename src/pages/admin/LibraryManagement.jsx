import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpen, FileText, Plus, Search, Upload, Trash2, Edit, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import BulkUploadDialog from '@/components/library/BulkUploadDialog';

export default function LibraryManagement() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'past_paper',
    subject_id: '',
    form_id: '',
    year: new Date().getFullYear(),
    is_premium: true,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['libraryResources'],
    queryFn: () => base44.entities.RevisionResource.list('-created_date', 200),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['allSubjects'],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['academicForms'],
    queryFn: () => base44.entities.AcademicForm.filter({ status: 'active' }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const subject = subjects.find(s => s.id === data.subject_id);
      const form = forms.find(f => f.id === data.form_id);
      return base44.entities.RevisionResource.create({
        ...data,
        subject_name: subject?.name || '',
        form_name: form?.name || '',
        status: 'published',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libraryResources'] });
      toast.success('Resource added!');
      setDialogOpen(false);
      setSelectedFile(null);
      resetForm();
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      if (result.file_url) {
        setSelectedFile({ name: file.name, url: result.file_url });
        toast.success('File uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload file');
      console.error(error);
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const subject = subjects.find(s => s.id === data.subject_id);
      const form = forms.find(f => f.id === data.form_id);
      return base44.entities.RevisionResource.update(id, {
        ...data,
        subject_name: subject?.name || '',
        form_name: form?.name || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libraryResources'] });
      toast.success('Resource updated!');
      setDialogOpen(false);
      setEditingResource(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.RevisionResource.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libraryResources'] });
      toast.success('Resource deleted!');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'past_paper',
      subject_id: '',
      form_id: '',
      year: new Date().getFullYear(),
      is_premium: true,
    });
    setSelectedFile(null);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.subject_id || !formData.form_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    const finalData = {
      ...formData,
      file_url: selectedFile?.url || editingResource?.file_url || null,
    };
    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: finalData });
    } else {
      createMutation.mutate(finalData);
    }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description || '',
      type: resource.type,
      subject_id: resource.subject_id,
      form_id: resource.form_id,
      year: resource.year,
      is_premium: resource.is_premium,
    });
    setSelectedFile(resource.file_url ? { name: 'Current file', url: resource.file_url } : null);
    setDialogOpen(true);
  };

  const typeLabels = {
    past_paper: 'Past Paper',
    model_answer: 'Model Answer',
    revision_notes: 'Revision Notes',
    exam_tips: 'Exam Tips',
    mock_exam: 'Mock Exam',
  };

  const filteredResources = resources.filter(r => {
    if (user.role === 'teacher') return true;
    if (user.role === 'admin') return true;
    return r.status === 'published';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" /> Library Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage revision resources and past papers</p>
        </div>
        <div className="flex gap-2">
          <BulkUploadDialog subjects={subjects} forms={forms} onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['libraryResources'] })} />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingResource(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingResource ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Title *</Label>
                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="mt-1" placeholder="e.g., 2024 Mathematics Paper 1" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="mt-1" placeholder="Brief description" />
              </div>
              
              {/* File Upload */}
              <div>
                <Label>Upload File (PDF/Word)</Label>
                {!selectedFile ? (
                  <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {uploadingFile ? 'Uploading...' : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">PDF or Word (max 10MB)</p>
                    </label>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <FileText className="w-5 h-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to upload</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploadingFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type *</Label>
                  <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    <option value="past_paper">Past Paper</option>
                    <option value="model_answer">Model Answer</option>
                    <option value="revision_notes">Revision Notes</option>
                    <option value="exam_tips">Exam Tips</option>
                    <option value="mock_exam">Mock Exam</option>
                  </select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject *</Label>
                  <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={formData.subject_id} onChange={e => setFormData({ ...formData, subject_id: e.target.value })}>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Form *</Label>
                  <select className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={formData.form_id} onChange={e => setFormData({ ...formData, form_id: e.target.value })}>
                    <option value="">Select form</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="premium" checked={formData.is_premium} onChange={e => setFormData({ ...formData, is_premium: e.target.checked })} />
                <Label htmlFor="premium" className="!m-0">Premium Resource (subscribers only)</Label>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || uploadingFile}>
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingResource ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="all">All Resources</TabsTrigger>
          <TabsTrigger value="past_paper">Past Papers</TabsTrigger>
          <TabsTrigger value="model_answer">Model Answers</TabsTrigger>
          <TabsTrigger value="revision_notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-5">
          <ResourceList resources={filteredResources} onEdit={handleEdit} onDelete={deleteMutation.mutate} typeLabels={typeLabels} />
        </TabsContent>
        <TabsContent value="past_paper" className="mt-5">
          <ResourceList resources={filteredResources.filter(r => r.type === 'past_paper')} onEdit={handleEdit} onDelete={deleteMutation.mutate} typeLabels={typeLabels} />
        </TabsContent>
        <TabsContent value="model_answer" className="mt-5">
          <ResourceList resources={filteredResources.filter(r => r.type === 'model_answer')} onEdit={handleEdit} onDelete={deleteMutation.mutate} typeLabels={typeLabels} />
        </TabsContent>
        <TabsContent value="revision_notes" className="mt-5">
          <ResourceList resources={filteredResources.filter(r => r.type === 'revision_notes')} onEdit={handleEdit} onDelete={deleteMutation.mutate} typeLabels={typeLabels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResourceList({ resources, onEdit, onDelete, typeLabels }) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filtered = resources.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subject_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = (resource) => {
    if (resource.file_url) {
      window.open(resource.file_url, '_blank');
    } else {
      toast.error('No file attached to this resource');
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by title or subject..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">No resources found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(resource => (
            <div key={resource.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{resource.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{typeLabels[resource.type]}</Badge>
                  {resource.is_premium && <Badge className="text-[10px] bg-accent/10 text-accent">Premium</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {resource.subject_name} · {resource.form_name} · {resource.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {resource.file_url && (
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(resource)} title="Download file">
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onEdit(resource)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this resource?')) onDelete(resource.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}