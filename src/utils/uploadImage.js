/**
 * uploadImage(file) → Promise<string>
 * Uploads an image file to Base44 storage and returns the public CDN URL.
 * Uses appParams (from localStorage/URL) for appId + auth token.
 */
import { appParams } from '@/lib/app-params';

export async function uploadImage(file) {
  const { appId, token } = appParams;
  if (!appId) throw new Error('App ID not found — cannot upload');

  const fd = new FormData();
  fd.append('file', file);

  const resp = await fetch(`https://base44.app/api/apps/${appId}/storage/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Upload failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const url = data.url || data.file_url || data.publicUrl || '';
  if (!url) throw new Error('Upload succeeded but no URL returned');
  return url;
}
