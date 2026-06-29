/**
 * uploadFile(file, { onProgress }) → Promise<string>
 *
 * Uploads any file to Supabase storage via raw XHR (not the SDK wrapper)
 * so we get real upload progress events and proper error surfacing.
 *
 * @param {File} file
 * @param {{ onProgress?: (pct: number) => void, maxMB?: number }} options
 * @returns {Promise<string>} CDN URL of the uploaded file
 */
import { appParams } from '@/lib/app-params';

const MAX_MB_DEFAULT = 100;

export async function uploadFile(file, { onProgress, maxMB = MAX_MB_DEFAULT } = {}) {
  if (!file) throw new Error('No file provided');

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) {
    throw new Error(`File too large: ${sizeMB.toFixed(1)} MB (max ${maxMB} MB)`);
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    // Progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = data?.file_url || data?.url || data?.publicUrl || data?.data?.url || '';
          if (!url) reject(new Error('Upload succeeded but no URL returned — contact support'));
          else resolve(url);
        } catch {
          reject(new Error('Upload response was not valid JSON'));
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.message || err?.error) msg = err.message || err.error;
        } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload — check your connection')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out — try a smaller file or check your connection')));

    // 5-minute timeout for large files
    xhr.timeout = 5 * 60 * 1000;

    // Use the Base44 upload endpoint directly
    const appId = appParams.appId || import.meta.env.VITE_SUPABASE_URL;
    const token = appParams.token || localStorage.getItem('aca_access_token') || '';

    xhr.open('POST', `/api/apps/${appId}/integrations/core/upload-file`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ── Backwards-compatible alias (existing code uses uploadImage) ───────────
export async function uploadImage(file, opts) {
  return uploadFile(file, opts);
}
