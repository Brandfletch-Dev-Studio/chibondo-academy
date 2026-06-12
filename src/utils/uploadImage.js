/**
 * uploadImage(file) → Promise<string>
 * Uploads an image file to Base44 storage and returns the public CDN URL.
 * Reads token fresh from localStorage on every call via SDK's getAccessToken().
 */
import { getAccessToken } from '@base44/sdk';

export async function uploadImage(file) {
  // Read token fresh from localStorage on every call — never stale
  const token = getAccessToken();
  const appId = import.meta.env.VITE_BASE44_APP_ID
    || window.localStorage.getItem('base44_app_id');

  if (!appId) throw new Error('App ID not available — cannot upload');
  if (!token) throw new Error('Not authenticated — please log in again');

  const fd = new FormData();
  fd.append('file', file);

  const resp = await fetch(`https://base44.app/api/apps/${appId}/storage/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Upload failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const url = data.url || data.file_url || data.publicUrl || '';
  if (!url) throw new Error('Upload succeeded but no URL in response');
  return url;
}
