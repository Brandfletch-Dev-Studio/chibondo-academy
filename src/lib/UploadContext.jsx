/**
 * UploadContext — global background video upload manager
 * The upload lives here (outside any page), so navigating away doesn't cancel it.
 * A floating progress pill is rendered at the root so it's always visible.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';

const UploadContext = createContext(null);

export function useUpload() {
  return useContext(UploadContext);
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([]);   // [{ id, name, progress, status, error }]
  const [expanded, setExpanded] = useState(true);
  const abortRefs = useRef({});                  // id → AbortController (future use)

  const updateUpload = useCallback((id, patch) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  /**
   * startUpload(file, lessonTitle, lessonId, onComplete)
   * Returns immediately — upload runs in background.
   * onComplete({ embedUrl, videoId }) is called when done.
   */
  const startUpload = useCallback(async (file, lessonTitle, lessonId, onComplete) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = lessonTitle || file.name;

    setUploads(prev => [...prev, { id, name, progress: 0, status: 'preparing', error: null }]);
    setExpanded(true);

    const apiKey = localStorage.getItem('bunny_api_key');
    const libId  = localStorage.getItem('bunny_lib_id');

    if (!apiKey || !libId) {
      updateUpload(id, { status: 'error', error: 'Video upload not configured. Contact admin.' });
      return;
    }

    try {
      // 1. Sign
      updateUpload(id, { status: 'preparing', progress: 2 });
      const signRes = await fetch('/api/bunny?action=sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, lessonId, bunnyLibraryId: libId, bunnyApiKey: apiKey }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || 'Could not get upload credentials');

      const { videoId, embedUrl, authSignature, authExpiry, libraryId: lib } = signData;
      updateUpload(id, { progress: 5, status: 'uploading' });

      // 2. TUS create
      const tusCreateRes = await fetch('https://video.bunnycdn.com/tusupload', {
        method: 'POST',
        headers: {
          AuthorizationSignature: authSignature,
          AuthorizationExpire:    String(authExpiry),
          VideoId:                videoId,
          LibraryId:              String(lib),
          'Tus-Resumable':        '1.0.0',
          'Upload-Length':        String(file.size),
          'Content-Type':         'application/offset+octet-stream',
        },
      });
      if (!tusCreateRes.ok) throw new Error(`Upload init failed (${tusCreateRes.status})`);
      const uploadLocation = tusCreateRes.headers.get('Location');
      if (!uploadLocation) throw new Error('No upload location returned');

      // 3. TUS PATCH chunks
      let offset = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const patchRes = await fetch(uploadLocation, {
          method: 'PATCH',
          headers: {
            AuthorizationSignature: authSignature,
            AuthorizationExpire:    String(authExpiry),
            VideoId:                videoId,
            LibraryId:              String(lib),
            'Tus-Resumable':        '1.0.0',
            'Upload-Offset':        String(offset),
            'Content-Type':         'application/offset+octet-stream',
          },
          body: chunk,
        });
        if (!patchRes.ok) throw new Error(`Upload failed at ${Math.round(offset/1024/1024)}MB`);
        offset += chunk.size;
        const pct = Math.round(5 + (offset / file.size) * 90);
        updateUpload(id, { progress: pct });
      }

      // 4. Done
      updateUpload(id, { progress: 100, status: 'done' });
      onComplete?.({ embedUrl, videoId });

      // Auto-dismiss after 8 s
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== id));
      }, 8000);

    } catch (err) {
      console.error('[video-upload]', err);
      updateUpload(id, { status: 'error', error: err.message });
    }
  }, [updateUpload]);

  const dismiss = useCallback((id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const activeCount = uploads.filter(u => u.status === 'uploading' || u.status === 'preparing').length;

  return (
    <UploadContext.Provider value={{ startUpload, uploads, activeCount }}>
      {children}
      {/* ── Floating upload pill ── */}
      {uploads.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,          // above the 64px bottom nav
            right: 12,
            zIndex: 9999,
            width: 280,
            maxWidth: 'calc(100vw - 24px)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            background: '#1A237E',
            color: 'white',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', cursor:'pointer', userSelect:'none' }}
            onClick={() => setExpanded(e => !e)}
          >
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              {activeCount > 0
                ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />
                : <CheckCircle2 size={15} style={{ color:'#FFD700' }} />}
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {activeCount > 0
                  ? `Uploading${uploads.length > 1 ? ` (${uploads.length})` : ''}…`
                  : 'Upload complete'}
              </span>
            </div>
            {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </div>

          {/* Upload rows */}
          {expanded && (
            <div style={{ padding:'0 14px 12px', display:'flex', flexDirection:'column', gap: 8 }}>
              {uploads.map(u => (
                <div key={u.id}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, opacity: 0.85, maxWidth: 200, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.name}
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                      {u.status === 'done' && <CheckCircle2 size={13} style={{ color:'#FFD700' }} />}
                      {u.status === 'error' && <XCircle size={13} style={{ color:'#ff6b6b' }} />}
                      {(u.status === 'done' || u.status === 'error') && (
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
                      <div style={{ flex: 1, height: 4, background:'rgba(255,255,255,0.2)',
                        borderRadius: 4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius: 4,
                          background: u.status === 'done' ? '#FFD700' : 'white',
                          width:`${u.progress}%`, transition:'width 0.3s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, opacity: 0.75, minWidth: 28, textAlign:'right' }}>
                        {u.status === 'done' ? '✓' : `${u.progress}%`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Keyframe for spinner */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </UploadContext.Provider>
  );
}
