import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Upload, Loader2, CheckCircle2, FileText, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/supabaseClient';
import { uploadFile } from '@/utils/uploadImage';

export default function BulkUploadDialog({ subjects, forms, onClose, onSuccess }) {
  const [mode, setMode] = useState('csv'); // 'csv' or 'files'
  const [bulkCsvFile, setBulkCsvFile] = useState(null);
  const [bulkResources, setBulkResources] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, name: '' });

  // File-based bulk upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileMeta, setFileMeta] = useState({}); // { fileName: { type, subject_id, form_id, is_premium, year } }

  const downloadCsvTemplate = () => {
    const headers = ['title', 'description', 'type', 'subject_name', 'form_name', 'year', 'is_premium'];
    const exampleRow = ['2024 Mathematics Paper 1', 'First paper exam', 'past_paper', 'Mathematics', 'Form 4', '2024', 'true'];
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library_resources_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const resources = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const resource = {};
      headers.forEach((header, index) => {
        resource[header] = values[index];
      });

      if (resource.title && resource.subject_name && resource.form_name) {
        const subject = subjects.find(s => s.name.toLowerCase() === resource.subject_name.toLowerCase());
        const form = forms.find(f => f.name.toLowerCase() === resource.form_name.toLowerCase());

        resources.push({
          title: resource.title,
          description: resource.description || '',
          type: resource.type || 'past_paper',
          subject_id: subject?.id || '',
          subject_name: resource.subject_name,
          form_id: form?.id || '',
          form_name: resource.form_name,
          year: parseInt(resource.year) || new Date().getFullYear(),
          is_premium: resource.is_premium?.toLowerCase() === 'true',
        });
      }
    }

    return resources;
  };

  const handleBulkCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setBulkCsvFile(file);
    const text = await file.text();
    const resources = parseCsv(text);

    if (resources.length === 0) {
      toast.error('No valid resources found in CSV');
      setBulkResources([]);
      return;
    }

    setBulkResources(resources);
    toast.success(`Found ${resources.length} resources to upload`);
  };

  const handleBulkUpload = async () => {
    if (bulkResources.length === 0) return;

    setBulkUploading(true);
    setUploadProgress({ current: 0, total: bulkResources.length, name: bulkResources[0].title });
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < bulkResources.length; i++) {
        const resource = bulkResources[i];
        setUploadProgress({ current: i, total: bulkResources.length, name: resource.title });
        try {
          await db.entities.RevisionResource.create({
            title: resource.title,
            description: resource.description,
            type: resource.type,
            subject_id: resource.subject_id,
            subject_name: resource.subject_name,
            form_id: resource.form_id,
            form_name: resource.form_name,
            year: resource.year,
            is_premium: resource.is_premium,
            status: 'published',
          });
          successCount++;
        } catch (error) {
          console.error('Failed to create resource:', resource.title, error);
          failCount++;
        }
      }

      toast.success(`Uploaded ${successCount} resources${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      onSuccess?.();
      resetState();
    } catch (error) {
      toast.error('Bulk upload failed');
      console.error(error);
    } finally {
      setBulkUploading(false);
      setUploadProgress({ current: 0, total: 0, name: '' });
    }
  };

  // ── File-based bulk upload ──
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newFiles = files.map(f => ({
      file: f,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Initialize metadata for each file
    newFiles.forEach(({ id, file }) => {
      const title = file.name.replace(/\.[^/.]+$/, ''); // remove extension
      setFileMeta(prev => ({
        ...prev,
        [id]: {
          title,
          type: file.name.toLowerCase().endsWith('.pdf') ? 'past_paper' : 'book',
          subject_id: '',
          form_id: '',
          year: new Date().getFullYear(),
          is_premium: true,
          uploaded: false,
          uploading: false,
          error: null,
        },
      }));
    });
  };

  const updateFileMeta = (id, field, value) => {
    setFileMeta(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const removeFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
    setFileMeta(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Upload a single file to storage and create the resource record
  const uploadOneFile = async (fileItem) => {
    const meta = fileMeta[fileItem.id];
    if (!meta || meta.uploaded || meta.uploading) return;

    if (!meta.subject_id || !meta.form_id) {
      toast.error(`Set subject and form for "${fileItem.file.name}"`);
      return;
    }

    updateFileMeta(fileItem.id, 'uploading', true);
    updateFileMeta(fileItem.id, 'error', null);

    try {
      // 1. Upload file to storage
      const fileUrl = await uploadFile(fileItem.file, { maxMB: 100 });

      // 2. Create resource record
      const subject = subjects.find(s => s.id === meta.subject_id);
      const form = forms.find(f => f.id === meta.form_id);

      await db.entities.RevisionResource.create({
        title: meta.title,
        type: meta.type,
        subject_id: meta.subject_id,
        subject_name: subject?.name || '',
        form_id: meta.form_id,
        form_name: form?.name || '',
        year: meta.year,
        is_premium: meta.is_premium,
        file_url: fileUrl,
        status: 'published',
      });

      updateFileMeta(fileItem.id, 'uploaded', true);
      updateFileMeta(fileItem.id, 'uploading', false);
    } catch (err) {
      updateFileMeta(fileItem.id, 'uploading', false);
      updateFileMeta(fileItem.id, 'error', err?.message || 'Upload failed');
    }
  };

  // Upload all files
  const uploadAllFiles = async () => {
    const pending = selectedFiles.filter(f => {
      const m = fileMeta[f.id];
      return m && !m.uploaded && !m.uploading;
    });

    if (pending.length === 0) return;

    // Validate all have subject + form
    for (const f of pending) {
      const m = fileMeta[f.id];
      if (!m.subject_id || !m.form_id) {
        toast.error(`Set subject and form for "${f.file.name}" before uploading`);
        return;
      }
    }

    setBulkUploading(true);
    setUploadProgress({ current: 0, total: pending.length, name: pending[0]?.file.name || '' });

    // Upload files sequentially (storage uploads can be heavy)
    for (let i = 0; i < pending.length; i++) {
      setUploadProgress({ current: i, total: pending.length, name: pending[i].file.name });
      await uploadOneFile(pending[i]);
    }

    setBulkUploading(false);
    setUploadProgress({ current: 0, total: 0, name: '' });

    const uploaded = selectedFiles.filter(f => fileMeta[f.id]?.uploaded).length;
    if (uploaded === selectedFiles.length) {
      toast.success(`All ${uploaded} files uploaded successfully!`);
      onSuccess?.();
      resetState();
    } else {
      const failed = selectedFiles.filter(f => fileMeta[f.id]?.error).length;
      toast.error(`${uploaded} uploaded, ${failed} failed. Check individual files.`);
      qc?.invalidateQueries?.({ queryKey: ['library-resources'] });
    }
  };

  const resetState = () => {
    setBulkCsvFile(null);
    setBulkResources([]);
    setSelectedFiles([]);
    setFileMeta({});
  };

  const handleClose = () => {
    if (bulkUploading) {
      if (!confirm('Uploads are in progress. Files already uploaded will stay, but pending ones will be cancelled. Continue?')) return;
    }
    resetState();
    onClose?.();
  };

  // Upload in background even if dialog closes (using fire-and-forget)
  const handleBackgroundUpload = async () => {
    const pending = selectedFiles.filter(f => {
      const m = fileMeta[f.id];
      return m && !m.uploaded && !m.uploading;
    });

    if (pending.length === 0) return;

    // Validate
    for (const f of pending) {
      const m = fileMeta[f.id];
      if (!m.subject_id || !m.form_id) {
        toast.error(`Set subject and form for all files first`);
        return;
      }
    }

    // Close dialog immediately, keep uploading in background
    toast.info(`${pending.length} files uploading in background…`);
    onClose?.();

    // Fire and forget — uploads continue even after dialog closes
    for (const f of pending) {
      try {
        await uploadOneFile(f);
      } catch (err) {
        console.error('Background upload failed:', f.file.name, err);
      }
    }

    // Invalidate queries when done
    const { useQueryClient } = await import('@tanstack/react-query');
    toast.success('Background upload complete!');
  };

  const TYPE_OPTIONS = [
    { value: 'book', label: 'Book' },
    { value: 'past_paper', label: 'Past Paper' },
    { value: 'exam_tips', label: 'Exam Tips' },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Resources</DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('files')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
              mode === 'files'
                ? 'border-transparent text-white'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
            style={mode === 'files' ? { background: 'hsl(var(--primary))' } : {}}
          >
            <Upload className="w-4 h-4 inline mr-1.5" />
            Upload Files
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
              mode === 'csv'
                ? 'border-transparent text-white'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
            style={mode === 'csv' ? { background: 'hsl(var(--primary))' } : {}}
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-1.5" />
            CSV Import
          </button>
        </div>

        {/* ── File Upload Mode ── */}
        {mode === 'files' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload multiple PDF/doc files at once. Set metadata for each, then upload all together.
              Files upload in the background — you can close this dialog and they'll keep going.
            </p>

            {/* File picker */}
            <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors bg-muted/20">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to select files (PDF, DOC, PPT, etc.)</span>
              <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.txt" onChange={handleFileSelect} />
            </label>

            {/* Selected files list with metadata */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                {selectedFiles.map(({ id, file }) => {
                  const meta = fileMeta[id] || {};
                  return (
                    <div key={id} className={`rounded-xl border p-3 ${meta.uploaded ? 'border-green-500/30 bg-green-500/5' : meta.error ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {meta.uploaded ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> :
                         meta.uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" /> :
                         meta.error ? <X className="w-4 h-4 text-destructive flex-shrink-0" /> :
                         <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className="flex-1 text-sm font-medium truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        {!meta.uploaded && !meta.uploading && (
                          <button onClick={() => removeFile(id)} className="w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {meta.error && (
                        <p className="text-xs text-destructive mb-2">{meta.error}</p>
                      )}

                      {!meta.uploaded && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            placeholder="Title"
                            value={meta.title || ''}
                            onChange={e => updateFileMeta(id, 'title', e.target.value)}
                            className="col-span-2 h-8 rounded-md border border-input bg-background px-2 text-xs"
                          />
                          <select
                            value={meta.type || 'past_paper'}
                            onChange={e => updateFileMeta(id, 'type', e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <select
                            value={meta.form_id || ''}
                            onChange={e => updateFileMeta(id, 'form_id', e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="">Form…</option>
                            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <select
                            value={meta.subject_id || ''}
                            onChange={e => updateFileMeta(id, 'subject_id', e.target.value)}
                            className="col-span-2 h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="">Subject…</option>
                            {subjects.filter(s => !meta.form_id || s.form_id === meta.form_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-xs col-span-2">
                            <input
                              type="checkbox"
                              checked={meta.is_premium ?? true}
                              onChange={e => updateFileMeta(id, 'is_premium', e.target.checked)}
                              className="rounded"
                            />
                            Premium only
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Upload progress */}
                {bulkUploading && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Uploading {uploadProgress.current + 1} of {uploadProgress.total}…</p>
                      <p className="text-xs text-muted-foreground truncate">{uploadProgress.name}</p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={uploadAllFiles}
                    disabled={bulkUploading || selectedFiles.every(f => fileMeta[f.id]?.uploaded || fileMeta[f.id]?.uploading)}
                    className="flex-1 gap-2"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    {bulkUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload {selectedFiles.filter(f => !fileMeta[f.id]?.uploaded && !fileMeta[f.id]?.uploading).length} Files
                  </Button>
                  <Button
                    onClick={handleBackgroundUpload}
                    variant="outline"
                    disabled={bulkUploading}
                    className="flex-1 gap-2"
                  >
                    Upload in Background
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CSV Mode ── */}
        {mode === 'csv' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-3">
              Create multiple resource records (without files) using a CSV file.
            </p>
            <Button variant="outline" onClick={downloadCsvTemplate} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>
            <div>
              <Label>Upload CSV File</Label>
              <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input type="file" id="bulk-csv-upload" accept=".csv" onChange={handleBulkCsvUpload} disabled={bulkUploading} className="hidden" />
                <label htmlFor="bulk-csv-upload" className="cursor-pointer">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {bulkUploading ? 'Processing...' : bulkCsvFile ? bulkCsvFile.name : 'Click to upload CSV'}
                  </p>
                </label>
              </div>
            </div>
            {bulkResources.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Title</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Subject</th>
                      <th className="text-left p-2">Form</th>
                      <th className="text-left p-2">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResources.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 truncate">{r.title}</td>
                        <td className="p-2">{r.type}</td>
                        <td className="p-2">{r.subject_name}</td>
                        <td className="p-2">{r.form_name}</td>
                        <td className="p-2">{r.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkResources.length > 10 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">+{bulkResources.length - 10} more...</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={bulkResources.length === 0 || bulkUploading}>
                {bulkUploading ? 'Uploading...' : `Upload ${bulkResources.length} Resources`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
