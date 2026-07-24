import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Upload, Loader2, CheckCircle2, FileText, X, CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/supabaseClient';
import { uploadFile } from '@/utils/uploadImage';

const TYPE_OPTIONS = [
  { value: 'book', label: 'Book' },
  { value: 'past_paper', label: 'Past Paper' },
  { value: 'exam_tips', label: 'Exam Tips' },
];

export default function BulkUploadDialog({ subjects, forms, open, onClose, onSuccess }) {
  const [mode, setMode] = useState('files');
  const [bulkCsvFile, setBulkCsvFile] = useState(null);
  const [bulkResources, setBulkResources] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  // File-based upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileMeta, setFileMeta] = useState({});

  // Background upload state — persists after dialog closes
  const [bgActive, setBgActive] = useState(false);
  const [bgProgress, setBgProgress] = useState({ current: 0, total: 0, fileName: '', pct: 0, done: 0, failed: 0 });
  const bgAbortRef = useRef(false);

  const updateFileMeta = useCallback((id, patch) => {
    setFileMeta(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // ── CSV helpers ──
  const downloadCsvTemplate = () => {
    const headers = ['title', 'description', 'type', 'subject_name', 'form_name', 'year', 'is_premium'];
    const exampleRow = ['2024 Mathematics Paper 1', 'First paper exam', 'past_paper', 'Mathematics', 'Form 4', '2024', 'true'];
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'library_resources_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const resources = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      if (row.title && row.subject_name && row.form_name) {
        const subject = subjects.find(s => s.name.toLowerCase() === row.subject_name.toLowerCase());
        const form = forms.find(f => f.name.toLowerCase() === row.form_name.toLowerCase());
        resources.push({
          title: row.title, description: row.description || '', type: row.type || 'past_paper',
          subject_id: subject?.id || '', subject_name: row.subject_name,
          form_id: form?.id || '', form_name: row.form_name,
          year: parseInt(row.year) || new Date().getFullYear(),
          is_premium: row.is_premium?.toLowerCase() === 'true',
        });
      }
    }
    return resources;
  };

  const handleCsvFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) { toast.error('Please upload a CSV file'); return; }
    setBulkCsvFile(file);
    const text = await file.text();
    const resources = parseCsv(text);
    if (resources.length === 0) { toast.error('No valid resources found in CSV'); setBulkResources([]); return; }
    setBulkResources(resources);
    toast.success(`Found ${resources.length} resources to upload`);
  };

  const handleCsvUpload = async () => {
    if (bulkResources.length === 0) return;
    setBulkUploading(true);
    let ok = 0, fail = 0;
    for (const r of bulkResources) {
      try {
        await db.entities.RevisionResource.create({ ...r, status: 'published' });
        ok++;
      } catch { fail++; }
    }
    setBulkUploading(false);
    toast.success(`Uploaded ${ok} resources${fail > 0 ? ` (${fail} failed)` : ''}`);
    onSuccess?.();
    resetState();
  };

  // ── File-based upload ──
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newFiles = files.map(f => ({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(({ id, file }) => {
      setFileMeta(prev => ({
        ...prev,
        [id]: {
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: file.name.toLowerCase().endsWith('.pdf') ? 'past_paper' : 'book',
          subject_id: '', form_id: '',
          year: new Date().getFullYear(),
          is_premium: true,
          uploaded: false, uploading: false, error: null, pct: 0,
        },
      }));
    });
    e.target.value = ''; // reset input so same file can be re-selected
  };

  const removeFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
    setFileMeta(prev => { const c = { ...prev }; delete c[id]; return c; });
  };

  // Upload a single file — with per-file progress
  const uploadOneFile = async (fileItem) => {
    const meta = fileMeta[fileItem.id];
    if (!meta || meta.uploaded || meta.uploading) return { ok: false };
    if (!meta.subject_id || !meta.form_id) { updateFileMeta(fileItem.id, { error: 'Set subject and form' }); return { ok: false }; }

    updateFileMeta(fileItem.id, { uploading: true, error: null, pct: 0 });

    try {
      const fileUrl = await uploadFile(fileItem.file, {
        maxMB: 100,
        onProgress: (pct) => updateFileMeta(fileItem.id, { pct }),
      });
      const subject = subjects.find(s => s.id === meta.subject_id);
      const form = forms.find(f => f.id === meta.form_id);
      await db.entities.RevisionResource.create({
        title: meta.title, type: meta.type,
        subject_id: meta.subject_id, subject_name: subject?.name || '',
        form_id: meta.form_id, form_name: form?.name || '',
        year: meta.year, is_premium: meta.is_premium,
        file_url: fileUrl, status: 'published',
      });
      updateFileMeta(fileItem.id, { uploaded: true, uploading: false, pct: 100 });
      return { ok: true };
    } catch (err) {
      updateFileMeta(fileItem.id, { uploading: false, error: err?.message || 'Upload failed' });
      return { ok: false };
    }
  };

  const validateAll = (files) => {
    for (const f of files) {
      const m = fileMeta[f.id];
      if (m && !m.uploaded && !m.uploading && (!m.subject_id || !m.form_id)) {
        toast.error(`Set subject & form for "${f.file.name}"`);
        return false;
      }
    }
    return true;
  };

  // Upload all (blocking — dialog stays open)
  const handleUploadAll = async () => {
    const pending = selectedFiles.filter(f => { const m = fileMeta[f.id]; return m && !m.uploaded && !m.uploading; });
    if (!pending.length || !validateAll(pending)) return;

    setBulkUploading(true);
    for (const f of pending) await uploadOneFile(f);
    setBulkUploading(false);

    const done = selectedFiles.filter(f => fileMeta[f.id]?.uploaded).length;
    const failed = selectedFiles.filter(f => fileMeta[f.id]?.error).length;
    if (failed === 0) { toast.success(`All ${done} files uploaded!`); onSuccess?.(); resetState(); }
    else toast.error(`${done} uploaded, ${failed} failed`);
  };

  // Upload in background — closes dialog, shows floating progress bar
  const handleBackgroundUpload = async () => {
    const pending = selectedFiles.filter(f => { const m = fileMeta[f.id]; return m && !m.uploaded && !m.uploading; });
    if (!pending.length || !validateAll(pending)) return;

    bgAbortRef.current = false;
    setBgActive(true);
    setBgProgress({ current: 0, total: pending.length, fileName: pending[0]?.file.name || '', pct: 0, done: 0, failed: 0 });

    // Close dialog immediately
    onClose?.();

    let done = 0, failed = 0;
    for (let i = 0; i < pending.length; i++) {
      if (bgAbortRef.current) break;
      setBgProgress(prev => ({ ...prev, current: i, fileName: pending[i].file.name, pct: 0 }));
      const result = await uploadOneFile(pending[i]);
      if (result.ok) done++; else failed++;
      setBgProgress(prev => ({ ...prev, done, failed }));
    }

    setBgActive(false);
    if (!bgAbortRef.current) {
      if (failed === 0) toast.success(`Background upload complete — ${done} files!`);
      else toast.error(`Background upload: ${done} done, ${failed} failed`);
      onSuccess?.();
      resetState();
    }
  };

  const cancelBackgroundUpload = () => {
    bgAbortRef.current = true;
    setBgActive(false);
    toast.info('Background upload cancelled');
    resetState();
  };

  const resetState = () => {
    setBulkCsvFile(null);
    setBulkResources([]);
    setSelectedFiles([]);
    setFileMeta({});
    setBulkUploading(false);
  };

  const handleClose = () => {
    if (bulkUploading) {
      if (!confirm('Uploads in progress. Already uploaded files will stay. Continue?')) return;
    }
    resetState();
    onClose?.();
  };

  // ── Floating background progress bar (renders even when dialog is closed) ──
  if (bgActive) {
    const overallPct = bgProgress.total > 0 ? Math.round(((bgProgress.done + bgProgress.failed) / bgProgress.total) * 100) : 0;
    return (
      <>
        <div className="fixed bottom-0 left-0 right-0 z-[100] px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold truncate">Background upload {bgProgress.done + bgProgress.failed + (bgProgress.total > bgProgress.done + bgProgress.failed ? 1 : 0)}/{bgProgress.total}</p>
                  <button onClick={cancelBackgroundUpload} className="text-xs text-muted-foreground hover:text-destructive font-medium flex-shrink-0">Cancel</button>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-1.5">{bgProgress.fileName}</p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${overallPct}%`, background: 'hsl(var(--primary))' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const pendingCount = selectedFiles.filter(f => { const m = fileMeta[f.id]; return m && !m.uploaded && !m.uploading; }).length;
  const uploadedCount = selectedFiles.filter(f => fileMeta[f.id]?.uploaded).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-[92vw] sm:max-w-2xl max-h-[88vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg">Bulk Upload Resources</DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-3">
          <button
            onClick={() => setMode('files')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
              mode === 'files' ? 'border-transparent text-white' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
            style={mode === 'files' ? { background: 'hsl(var(--primary))' } : {}}
          >
            <Upload className="w-3.5 h-3.5 inline sm:mr-1.5" />
            <span className="hidden sm:inline">Upload Files</span><span className="sm:hidden">Files</span>
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
              mode === 'csv' ? 'border-transparent text-white' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
            style={mode === 'csv' ? { background: 'hsl(var(--primary))' } : {}}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 inline sm:mr-1.5" />
            <span className="hidden sm:inline">CSV Import</span><span className="sm:hidden">CSV</span>
          </button>
        </div>

        {/* ── File Upload Mode ── */}
        {mode === 'files' && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Select multiple files, set metadata for each, then upload all at once or in the background.
            </p>

            {/* File picker — compact */}
            <label className="flex items-center justify-center gap-2 px-3 py-4 sm:py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors bg-muted/20">
              <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground">Select files (PDF, DOC, PPT…)</span>
              <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.txt" onChange={handleFileSelect} />
            </label>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {/* Overall summary */}
                {(uploadedCount > 0 || bulkUploading) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-xs">
                    <span className="text-green-500 font-medium">{uploadedCount} done</span>
                    {bulkUploading && <span className="text-primary font-medium">· uploading…</span>}
                    {pendingCount > 0 && !bulkUploading && <span className="text-muted-foreground">· {pendingCount} pending</span>}
                  </div>
                )}

                {selectedFiles.map(({ id, file }) => {
                  const meta = fileMeta[id] || {};
                  const isUploading = meta.uploading;
                  const isUploaded = meta.uploaded;
                  const hasError = meta.error;
                  return (
                    <div key={id} className={`rounded-lg border p-2.5 sm:p-3 ${
                      isUploaded ? 'border-green-500/30 bg-green-500/5' :
                      hasError ? 'border-destructive/30 bg-destructive/5' :
                      'border-border bg-card'
                    }`}>
                      {/* Row 1: icon + name + size + remove */}
                      <div className="flex items-center gap-2 mb-1.5">
                        {isUploaded ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> :
                         isUploading ? <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" /> :
                         hasError ? <X className="w-4 h-4 text-destructive flex-shrink-0" /> :
                         <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className="flex-1 text-xs sm:text-sm font-medium truncate">{file.name}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                        {isUploading && <span className="text-[10px] sm:text-xs text-primary font-semibold flex-shrink-0">{meta.pct || 0}%</span>}
                        {!isUploaded && !isUploading && (
                          <button onClick={() => removeFile(id)} className="w-5 h-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Progress bar (during upload) */}
                      {isUploading && (
                        <div className="h-1 rounded-full bg-muted overflow-hidden mb-1.5">
                          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${meta.pct || 0}%`, background: 'hsl(var(--primary))' }} />
                        </div>
                      )}

                      {/* Error message */}
                      {hasError && <p className="text-[10px] sm:text-xs text-destructive mb-1.5">{meta.error}</p>}

                      {/* Metadata fields — compact grid */}
                      {!isUploaded && (
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="Title"
                            value={meta.title || ''}
                            onChange={e => updateFileMeta(id, { title: e.target.value })}
                            className="col-span-2 h-7 rounded-md border border-input bg-background px-2 text-[11px] sm:text-xs"
                          />
                          <select
                            value={meta.type || 'past_paper'}
                            onChange={e => updateFileMeta(id, { type: e.target.value })}
                            className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] sm:text-xs"
                          >
                            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <select
                            value={meta.form_id || ''}
                            onChange={e => updateFileMeta(id, { form_id: e.target.value })}
                            className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] sm:text-xs"
                          >
                            <option value="">Form</option>
                            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <select
                            value={meta.subject_id || ''}
                            onChange={e => updateFileMeta(id, { subject_id: e.target.value })}
                            className="col-span-2 h-7 rounded-md border border-input bg-background px-1.5 text-[11px] sm:text-xs"
                          >
                            <option value="">Subject</option>
                            {subjects.filter(s => !meta.form_id || s.form_id === meta.form_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-[11px] sm:text-xs col-span-2 pl-0.5">
                            <input type="checkbox" checked={meta.is_premium ?? true} onChange={e => updateFileMeta(id, { is_premium: e.target.checked })} className="rounded h-3.5 w-3.5" />
                            Premium only
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleUploadAll}
                    disabled={bulkUploading || pendingCount === 0}
                    className="flex-1 gap-1.5 h-9 text-xs sm:text-sm"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    {bulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload {pendingCount > 0 ? pendingCount : ''} {pendingCount === 1 ? 'File' : 'Files'}
                  </Button>
                  <Button
                    onClick={handleBackgroundUpload}
                    variant="outline"
                    disabled={bulkUploading || pendingCount === 0}
                    className="flex-1 gap-1.5 h-9 text-xs sm:text-sm"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    Background
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CSV Mode ── */}
        {mode === 'csv' && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Create resource records (without files) using a CSV file.
            </p>
            <Button variant="outline" onClick={downloadCsvTemplate} className="w-full h-9 text-xs sm:text-sm">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV Template
            </Button>
            <div>
              <Label className="text-xs sm:text-sm">Upload CSV File</Label>
              <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <input type="file" id="bulk-csv-upload" accept=".csv" onChange={handleCsvFile} disabled={bulkUploading} className="hidden" />
                <label htmlFor="bulk-csv-upload" className="cursor-pointer">
                  <FileSpreadsheet className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {bulkUploading ? 'Processing…' : bulkCsvFile ? bulkCsvFile.name : 'Click to upload CSV'}
                  </p>
                </label>
              </div>
            </div>
            {bulkResources.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-[11px] sm:text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-1.5">Title</th>
                      <th className="text-left p-1.5">Type</th>
                      <th className="text-left p-1.5">Subject</th>
                      <th className="text-left p-1.5">Form</th>
                      <th className="text-left p-1.5">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResources.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-1.5 truncate max-w-24">{r.title}</td>
                        <td className="p-1.5">{r.type}</td>
                        <td className="p-1.5">{r.subject_name}</td>
                        <td className="p-1.5">{r.form_name}</td>
                        <td className="p-1.5">{r.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkResources.length > 10 && <p className="text-[10px] text-muted-foreground p-1.5 text-center">+{bulkResources.length - 10} more…</p>}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} className="h-9 text-xs sm:text-sm">Cancel</Button>
              <Button onClick={handleCsvUpload} disabled={bulkResources.length === 0 || bulkUploading} className="h-9 text-xs sm:text-sm">
                {bulkUploading ? 'Uploading…' : `Upload ${bulkResources.length} Resources`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
