/**
 * uploadFile — uploads to Supabase Storage.
 * - Images → 'avatars' bucket (5MB limit)
 * - Documents (PDF, DOCX, etc.) → 'library' bucket (100MB limit)
 * Returns the public CDN URL.
 *
 * Uses the anon key for storage uploads (not the user's auth token) because:
 * 1. The anon key never expires (user tokens can expire mid-session)
 * 2. Both buckets have anon RLS policies for INSERT
 * 3. Storage uploads don't need user-level auth — RLS handles access control
 */
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

function getBucketForFile(file) {
  const isImage = IMAGE_TYPES.includes(file.type) || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
  if (isImage) return { bucket: 'avatars', maxMB: 5 };
  return { bucket: 'library', maxMB: 100 };
}

export async function uploadFile(file, { onProgress, maxMB } = {}) {
  if (!file) throw new Error('No file provided');

  const { bucket, maxMB: bucketMaxMB } = getBucketForFile(file);
  const effectiveMaxMB = maxMB || bucketMaxMB;
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > effectiveMaxMB) throw new Error(`File too large: ${sizeMB.toFixed(1)} MB (max ${effectiveMaxMB} MB)`);

  // Unique filename
  const ext  = file.name.split('.').pop() || 'bin';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `public/${name}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        resolve(publicUrl);
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error || err?.message) msg = err.error || err.message;
        } catch {}
        console.error('[uploadFile] Upload failed:', xhr.status, xhr.responseText);
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error',   () => { console.error('[uploadFile] Network error'); reject(new Error('Network error during upload')); });
    xhr.addEventListener('abort',   () => { console.error('[uploadFile] Aborted'); reject(new Error('Upload cancelled')); });
    xhr.addEventListener('timeout', () => { console.error('[uploadFile] Timeout'); reject(new Error('Upload timed out')); });
    xhr.timeout = 5 * 60 * 1000;

    // Always use the anon key for storage uploads — it never expires
    // and both buckets have anon INSERT policies
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON);
    xhr.setRequestHeader('x-upsert', 'true');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

// Backwards-compatible alias
export async function uploadImage(file, opts) {
  return uploadFile(file, opts);
}
