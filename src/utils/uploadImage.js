/**
 * uploadImage(file) → Promise<string>
 * Uploads any file to Base44 storage via the SDK and returns the public CDN URL.
 */
import { base44 } from '@/api/base44Client';

export async function uploadImage(file) {
  try {
    const result = await base44.integrations.Core.UploadFile({ file });
    const url = result?.file_url || result?.url || result?.publicUrl || '';
    if (!url) throw new Error('Upload succeeded but no URL returned');
    return url;
  } catch (err) {
    throw new Error(`Upload failed: ${err?.message || 'Unknown error'}`);
  }
}
