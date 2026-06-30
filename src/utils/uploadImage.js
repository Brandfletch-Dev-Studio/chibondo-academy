/**
 * uploadFile / uploadImage — upload to Supabase Storage 'avatars' bucket.
 * Returns the public CDN URL.
 */
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function uploadFile(file, { onProgress, maxMB = 5 } = {}) {
  if (!file) throw new Error('No file provided');
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) throw new Error(`File too large: ${sizeMB.toFixed(1)} MB (max ${maxMB} MB)`);

  // Unique filename
  const ext  = file.name.split('.').pop() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `public/${name}`;

  const token = localStorage.getItem('aca_access_token') || localStorage.getItem('token') || SUPABASE_ANON;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
        resolve(publicUrl);
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try { const err = JSON.parse(xhr.responseText); if (err?.error || err?.message) msg = err.error || err.message; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error',   () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort',   () => reject(new Error('Upload cancelled')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
    xhr.timeout = 5 * 60 * 1000;

    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/avatars/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.send(file);
  });
}

// Backwards-compatible alias
export async function uploadImage(file, opts) {
  return uploadFile(file, opts);
}
