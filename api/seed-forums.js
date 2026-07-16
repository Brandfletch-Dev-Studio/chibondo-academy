import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nckjjfxlmmsnmnexcgzg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ja2pqZnhsbW1zbm1uZXhjZ3pnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY5NjQyMywiZXhwIjoyMDk4MjcyNDIzfQ.xCxAkxWFa756lBiBHT-AaoSPg9S_RyH3xTJLFXIcZaI';

export default async function handler(req, res) {
  const secret = req.headers['x-seed-secret'];
  if (secret !== 'aca-forum-seed-2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const results = [];

  // Create tables via raw SQL using supabase.rpc if available, else use REST
  // Since direct SQL is locked, create via REST with service role

  // ── Seed study_groups via REST inserts ──
  const subjects = [
    { id: '6a24d44200000000000000000000', name: 'MSCE Additional Mathematics', icon: '∑' },
    { id: '6a24142900000000000000000000', name: 'MSCE Agriculture Book 3', icon: '🌱' },
    { id: '6a2412f600000000000000000000', name: 'MSCE Agriculture Book 4', icon: '🌱' },
    { id: '6a2411c500000000000000000000', name: 'MSCE Biology Book 3', icon: '🧬' },
    { id: '6a24132800000000000000000000', name: 'MSCE Biology Book 4', icon: '🧬' },
    { id: '6a24141800000000000000000000', name: 'MSCE Chemistry Book 3', icon: '⚗️' },
    { id: '6a2412ce00000000000000000000', name: 'MSCE Chemistry Book 4', icon: '⚗️' },
    { id: '6a24127300000000000000000000', name: 'MSCE Chichewa Language', icon: '🗣️' },
    { id: '6a24129200000000000000000000', name: 'MSCE Chichewa Literature', icon: '📚' },
    { id: '6a240eaa00000000000000000000', name: 'MSCE English Language', icon: '📖' },
    { id: '6a240ec100000000000000000000', name: 'MSCE English Literature', icon: '📚' },
    { id: '6a24144d00000000000000000000', name: 'MSCE Geography Book 3', icon: '🌍' },
    { id: '6a24137700000000000000000000', name: 'MSCE Geography Book 4', icon: '🌍' },
    { id: '6a24113500000000000000000000', name: 'MSCE History (Central African)', icon: '📜' },
    { id: '6a24115000000000000000000000', name: 'MSCE History (World History)', icon: '📜' },
    { id: '6a24118500000000000000000000', name: 'MSCE Mathematics Book 3', icon: '📐' },
    { id: '6a24123e00000000000000000000', name: 'MSCE Mathematics Book 4', icon: '📐' },
    { id: '6a240ef000000000000000000000', name: 'MSCE Physics Book 3', icon: '⚡' },
    { id: '6a240edd00000000000000000000', name: 'MSCE Physics Book 4', icon: '⚡' },
    { id: '6a27cb4200000000000000000000', name: 'Physics Book 3 (Jonathan Richard)', icon: '⚡' },
    { id: '6a27cb6600000000000000000000', name: 'Physics Book 4 (Jonathan Richard)', icon: '⚡' },
  ];

  for (const s of subjects) {
    const { error } = await supabase.from('study_groups').upsert({
      id: `subject-${s.id.slice(0,8)}`,
      name: s.name,
      icon: s.icon,
      subject_id: s.id.slice(0,8),
      creator_id: 'system',
      creator_name: 'Chibondo Academy',
      member_ids: [],
      member_count: 0,
      is_private: false,
      status: 'active',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true });
    results.push({ subject: s.name, error: error?.message || null });
  }

  // Seed community group
  const { error: comErr } = await supabase.from('study_groups').upsert({
    id: 'community-global',
    name: 'Chibondo Academy',
    icon: '🎓',
    creator_id: 'system',
    creator_name: 'Chibondo Academy',
    member_ids: [],
    member_count: 0,
    is_private: false,
    status: 'active',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true });
  results.push({ subject: 'community-global', error: comErr?.message || null });

  return res.status(200).json({ ok: true, results });
}
