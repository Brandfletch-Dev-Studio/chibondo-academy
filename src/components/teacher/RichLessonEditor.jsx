import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Link as LinkIcon, X, Plus, Save } from 'lucide-react';

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ['link', 'image', 'video'],
    ['clean'],
  ],
};

export default function RichLessonEditor({ lesson, onSave, onCancel }) {
  const [content, setContent] = useState(lesson?.content || '');
  const [attachments, setAttachments] = useState(lesson?.attachments || []);
  const [newAttachment, setNewAttachment] = useState({ name: '', url: '' });

  const handleAddAttachment = () => {
    if (!newAttachment.name || !newAttachment.url) return;
    setAttachments([...attachments, { ...newAttachment }]);
    setNewAttachment({ name: '', url: '' });
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      ...lesson,
      content,
      attachments,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lesson Content Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={MODULES}
              placeholder="Write your lesson content here..."
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Attachments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.name}</p>
                <p className="text-xs text-muted-foreground truncate">{att.url}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveAttachment(idx)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>File Name</Label>
              <Input
                value={newAttachment.name}
                onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
                placeholder="e.g. Worksheet.pdf"
              />
            </div>
            <div>
              <Label>File URL</Label>
              <Input
                value={newAttachment.url}
                onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button onClick={handleAddAttachment} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Attachment
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          Save Lesson
        </Button>
      </div>
    </div>
  );
}