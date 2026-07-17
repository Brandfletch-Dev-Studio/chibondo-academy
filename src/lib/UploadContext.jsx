/**
 * UploadContext — global background video upload manager
 * 
 * Upload flow (browser → Vercel proxy → Bunny):
 * 1. POST /api/bunny-upload?action=create  → get videoId
 * 2. Slice file into 20MB chunks
 * 3. POST /api/bunny-upload?action=chunk   → proxy each chunk to Bunny
 * 4. onComplete fires → lesson updated with embedUrl
 *
 * Teacher can navigate away at any time — upload continues in background.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';

const UploadContext = createContext(null);
export function useUpload() { return useContext(UploadContext); }

// Chunk size: 20MB — safe for Vercel's 4.5MB bodyParser limit when bodyParser is OFF
// Vercel raw body streaming has no enforced limit (up to 100MB on Pro, ~50MB on Hobby)
const CHUNK_SIZE = 20 * 1024 * 1024;

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([]);
  const [expanded, setExpanded] = useState(true);

  const updateUpload = useCallback((id, patch) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const startUpload = useCallback(async (file, lessonTitle, lessonId, onComplete) => {
    const id    = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name  = lessonTitle || file.name;

    setUploads(prev => [...prev, { id, name, progress: 0, status: 'preparing', error: null }]);
    setExpanded(true);

    const apiKey = localStorage.getItem('bunny_api_key');
    const libId  = localStorage.getItem('bunny_lib_id');

    if (!apiKey || !libId) {
      updateUpload(id, { status: 'error', error: 'Video upload not configured. Contact admin.' });
      return;
    }

    try {
      // ── Step 1: Create video slot ─────────────────────────────────────────
      updateUpload(id, { status: 'preparing', progress: 2 });

      const createRes = await fetch('/api/bunny-upload?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          name,
          lessonId,
          bunnyLibraryId: libId,
          bunnyApiKey:    apiKey,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Could not create video slot');

      const { videoId, embedUrl } = createData;
      updateUpload(id, { progress: 5, status: 'uploading' });

      // ── Step 2: Upload file in chunks through proxy ───────────────────────
      const fileSize   = file.size;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      let offset = 0;
      let chunkIndex = 0;

      while (offset < fileSize) {
        const chunk     = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
        const chunkSize = chunk.size;
        const isLast    = offset + chunkSize >= fileSize;
        const isSingle  = totalChunks === 1;

        const chunkRes = await fetch('/api/bunny-upload?action=chunk', {
          method: 'POST',
          headers: {
            'Content-Type':     'application/octet-stream',
            'X-Bunny-VideoId':  videoId,
            'X-Bunny-LibraryId': libId,
            'X-Bunny-ApiKey':   apiKey,
            'X-Upload-Offset':  String(offset),
            'X-Upload-Length':  String(fileSize),
            'X-Is-Last':        String(isLast),
          },
          body: chunk,
        });

        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({ error: `HTTP ${chunkRes.status}` }));
          throw new Error(err.error || `Chunk ${chunkIndex + 1} failed`);
        }

        offset += chunkSize;
        chunkIndex++;
        // Progress: 5% (create) → 95% (all chunks uploaded)
        const pct = Math.round(5 + (offset / fileSize) * 90);
        updateUpload(id, { progress: pct });
      }

      // ── Step 3: Done ──────────────────────────────────────────────────────
      updateUpload(id, { progress: 100, status: 'done' });
      onComplete?.({ embedUrl, videoId });

      // Auto-dismiss after 10 s
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== id));
      }, 10_000);

    } catch (err) {
      console.error('[video-upload]', err);
      updateUpload(id, { status: 'error', error: err.message });
    }
  }, [updateUpload]);

  const dismiss = useCallback((id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const activeCount = uploads.filter(u => ['uploading','preparing'].includes(u.status)).length;

  return (
    <UploadContext.Provider value={{ startUpload, uploads, activeCount }}>
      {children}

      {/* ── Floating upload pill ─────────────────────────────────────────── */}
      {uploads.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 80, right: 12, zIndex: 9999,
          width: 288, maxWidth: 'calc(100vw - 24px)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          background: '#1A237E', color: 'white', fontFamily: 'inherit',
        }}>
          {/* Header */}
          <div
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', cursor:'pointer', userSelect:'none' }}
            onClick={() => setExpanded(e => !e)}
          >
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              {activeCount > 0
                ? <Loader2 size={15} style={{ animation:'aca-spin 1s linear infinite' }} />
                : <CheckCircle2 size={15} style={{ color:'#FFD700' }} />}
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {activeCount > 0
                  ? `Uploading${uploads.length > 1 ? ` (${uploads.length})` : ''}…`
                  : 'Upload complete ✓'}
              </span>
            </div>
            {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </div>

          {/* Rows */}
          {expanded && (
            <div style={{ padding:'0 14px 12px', display:'flex', flexDirection:'column', gap: 10 }}>
              {uploads.map(u => (
                <div key={u.id}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, opacity: 0.85, maxWidth: 210,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.name}
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                      {u.status === 'done'  && <CheckCircle2 size={13} style={{ color:'#FFD700' }} />}
                      {u.status === 'error' && <XCircle      size={13} style={{ color:'#ff6b6b' }} />}
                      {['done','error'].includes(u.status) && (
                        <button onClick={() => dismiss(u.id)}
                          style={{ background:'none', border:'none', color:'white', cursor:'pointer',
                            opacity: 0.6, padding: 0, display:'flex' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {u.status === 'error' ? (
                    <p style={{ fontSize: 10, color:'#ff9999', margin: 0 }}>{u.error}</p>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                      <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.2)',
                        borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4,
                          background: u.status === 'done' ? '#FFD700' : 'rgba(255,255,255,0.9)',
                          width:`${u.progress}%`, transition:'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, opacity:0.75, minWidth:30, textAlign:'right' }}>
                        {u.status === 'preparing' ? 'prep…'
                          : u.status === 'done'   ? '✓'
                          : `${u.progress}%`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes aca-spin{to{transform:rotate(360deg)}}`}</style>
    </UploadContext.Provider>
  );
}
