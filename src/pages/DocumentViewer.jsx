import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  BookOpen, FileText, Loader2, Lock, AlertCircle, ChevronLeft, ChevronRight,
  ExternalLink, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const GOLD        = 'hsl(43 74% 52%)';
const GOLD_BG     = 'hsl(43 74% 52% / 0.12)';
const GOLD_BORDER = 'hsl(43 74% 52% / 0.3)';

const TYPE_CONFIG = {
  past_paper:     { label: 'Past Paper',     color: 'bg-primary/10 text-primary border-primary/20' },
  model_answer:   { label: 'Model Answer',   color: 'bg-success/10 text-success border-success/20' },
  revision_notes: { label: 'Revision Notes', color: 'bg-accent/10 text-accent-foreground border-accent/20' },
  exam_tips:      { label: 'Exam Tips',      color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  mock_exam:      { label: 'Mock Exam',      color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function DocumentViewer() {
  const { resourceId } = useParams();
  const navigate        = useNavigate();
  const ctx             = useOutletContext() ?? {};
  const { user }        = ctx;

  const [zoom, setZoom]         = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError]   = useState(false);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch the specific resource
  const { data: resource, isLoading, error } = useQuery({
    queryKey: ['library-resource', resourceId],
    queryFn: async () => {
      const results = await base44.entities.RevisionResource.filter({ id: resourceId });
      return results[0] || null;
    },
    enabled: !!resourceId,
  });

  // Check subscription
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => base44.entities.Subscription.filter(
      { student_id: user.id, status: 'active' }, '-created_date', 1
    ),
    enabled: !!user?.id,
    select: d => d[0] || null,
  });

  const hasPaidFees = !!subscription;
  const locked      = resource?.is_premium && !hasPaidFees;
  const fileUrl     = resource?.file_url;

  // Google Docs Viewer URL — works for PDF, DOCX, PPTX without plugin
  const viewerUrl = fileUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
    : null;

  const handleZoomIn  = () => setZoom(z => Math.min(z + 20, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z - 20, 50));
  const handleReset   = () => setZoom(100);

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, [fullscreen]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD }} />
        <p className="text-muted-foreground text-sm">Loading document…</p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!resource || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-destructive/60" />
        <h2 className="text-lg font-semibold">Resource Not Found</h2>
        <p className="text-sm text-muted-foreground">This document may have been removed.</p>
        <Button variant="outline" onClick={() => navigate('/library')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
        </Button>
      </div>
    );
  }

  // ── Locked ───────────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: GOLD_BG }}>
          <Lock className="w-7 h-7" style={{ color: GOLD }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Premium Resource</h2>
          <p className="text-sm text-muted-foreground mt-1">Subscribe to access this document.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/library')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => navigate('/subscription')}
            style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
            Upgrade to Premium
          </Button>
        </div>
      </div>
    );
  }

  // ── No file ──────────────────────────────────────────────────────────────────
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <FileText className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold">No File Attached</h2>
        <p className="text-sm text-muted-foreground">This resource doesn't have a file yet.</p>
        <Button variant="outline" onClick={() => navigate('/library')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
        </Button>
      </div>
    );
  }

  const config = TYPE_CONFIG[resource.type] || { label: resource.type, color: 'bg-muted text-muted-foreground border-muted' };

  return (
    <div ref={containerRef} className={cn('flex flex-col', fullscreen ? 'fixed inset-0 z-50 bg-background' : 'min-h-[calc(100vh-4rem)]')}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm flex-wrap">
        {/* Back */}
        <Button size="sm" variant="ghost" onClick={() => navigate('/library')} className="gap-1.5 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Library</span>
        </Button>

        <div className="w-px h-5 bg-border flex-shrink-0" />

        {/* Document info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
          <span className="text-sm font-semibold truncate">{resource.title}</span>
          <Badge className={cn('text-[10px] px-1.5 py-0.5 border flex-shrink-0 hidden sm:inline-flex', config.color)}>
            {config.label}
          </Badge>
          {resource.subject_name && (
            <span className="text-xs text-muted-foreground truncate hidden md:block">
              {resource.subject_name}{resource.form_name ? ` · ${resource.form_name}` : ''}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Zoom */}
          <Button size="sm" variant="ghost" onClick={handleZoomOut} disabled={zoom <= 50} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono w-10 text-center select-none">{zoom}%</span>
          <Button size="sm" variant="ghost" onClick={handleZoomIn} disabled={zoom >= 200} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReset} title="Reset zoom">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Fullscreen */}
          <Button size="sm" variant="ghost" onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          {/* Open in new tab */}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" title="Open in new tab">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>

          {/* Download */}
          <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1.5 hidden sm:flex"
              style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
              <Download className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Download</span>
            </Button>
          </a>
        </div>
      </div>

      {/* ── Document Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-muted/30 overflow-auto">

        {/* Iframe loading spinner */}
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 pointer-events-none">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD }} />
            <p className="text-sm text-muted-foreground">Rendering document…</p>
            <p className="text-xs text-muted-foreground/60">This may take a moment for large files</p>
          </div>
        )}

        {/* Iframe error fallback */}
        {iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-4 z-10">
            <AlertCircle className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <h3 className="font-semibold">Couldn't render in-app</h3>
              <p className="text-sm text-muted-foreground mt-1">Some files block embedded viewing. Use the buttons below.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={viewerUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Eye className="w-4 h-4" /> Open in Google Docs Viewer
                </Button>
              </a>
              <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                <Button className="gap-2 w-full sm:w-auto"
                  style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
                  <Download className="w-4 h-4" /> Download File
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* The actual viewer */}
        {!iframeError && (
          <div
            style={{
              width: `${zoom}%`,
              minWidth: zoom > 100 ? `${zoom}%` : '100%',
              height: fullscreen ? 'calc(100vh - 52px)' : 'calc(100vh - 120px)',
              transition: 'width 0.2s ease',
              margin: '0 auto',
            }}
          >
            <iframe
              ref={iframeRef}
              src={viewerUrl}
              title={resource.title}
              className={cn(
                'w-full h-full border-0 transition-opacity duration-300',
                iframeLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeError(true)}
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        )}
      </div>

      {/* ── Mobile download bar ──────────────────────────────────────────────── */}
      <div className="sm:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border bg-card">
        <a href={fileUrl} download target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button size="sm" className="w-full gap-2"
            style={{ background: GOLD, color: 'hsl(222 47% 8%)', border: 'none' }}>
            <Download className="w-4 h-4" /> Download
          </Button>
        </a>
        <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button size="sm" variant="outline" className="w-full gap-2">
            <ExternalLink className="w-4 h-4" /> Open in Browser
          </Button>
        </a>
      </div>
    </div>
  );
}
