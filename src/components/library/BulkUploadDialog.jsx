import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function BulkUploadDialog({ subjects, forms, onUploadComplete }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkCsvFile, setBulkCsvFile] = useState(null);
  const [bulkResources, setBulkResources] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const downloadCsvTemplate = () => {
    const headers = ['title', 'description', 'type', 'subject_name', 'form_name', 'year', 'is_premium'];
    const exampleRow = ['2024 Mathematics Paper 1', 'First paper exam', 'past_paper', 'Mathematics', 'Form 4', '2024', 'true'];
    // Valid types: book, past_paper, exam_tips
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
    if (!file || file.type !== 'text/csv') {
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
    let successCount = 0;
    let failCount = 0;

    try {
      for (const resource of bulkResources) {
        try {
          await base44.entities.RevisionResource.create({
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
      onUploadComplete();
      setDialogOpen(false);
      setBulkResources([]);
      setBulkCsvFile(null);
    } catch (error) {
      toast.error('Bulk upload failed');
      console.error(error);
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Resources</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Upload multiple resources at once using a CSV file. Follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Download the CSV template</li>
              <li>Fill in your resources — valid types: <code className="text-xs bg-muted px-1 rounded">book</code>, <code className="text-xs bg-muted px-1 rounded">past_paper</code>, <code className="text-xs bg-muted px-1 rounded">exam_tips</code></li>
              <li>Upload the CSV file</li>
              <li>Review and confirm the upload</li>
            </ol>
          </div>
          <Button variant="outline" onClick={downloadCsvTemplate} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
          <div>
            <Label>Upload CSV File</Label>
            <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="bulk-csv-upload"
                accept=".csv"
                onChange={handleBulkCsvUpload}
                disabled={bulkUploading}
                className="hidden"
              />
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpload} disabled={bulkResources.length === 0 || bulkUploading}>
              {bulkUploading ? 'Uploading...' : `Upload ${bulkResources.length} Resources`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}