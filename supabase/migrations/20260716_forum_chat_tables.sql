-- ============================================================
-- Chibondo Academy: Forum Chat Tables Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nckjjfxlmmsnmnexcgzg/sql/new
-- ============================================================

-- 1. Study Groups (for user-created custom groups only)
CREATE TABLE IF NOT EXISTS public.study_groups (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT DEFAULT '💬',
  icon_url     TEXT,
  subject_id   TEXT,
  subject_name TEXT,
  creator_id   TEXT NOT NULL DEFAULT 'system',
  creator_name TEXT,
  member_ids   TEXT[] DEFAULT '{}',
  member_names TEXT[] DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  is_private   BOOLEAN DEFAULT false,
  status       TEXT DEFAULT 'active',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  created_by   TEXT
);

-- 2. Group Chat Messages (used for ALL chats: subject chats + community + custom groups)
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id     TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  author_name  TEXT,
  author_avatar TEXT,
  author_role  TEXT DEFAULT 'student',
  body         TEXT NOT NULL,
  reply_to_id  TEXT,
  reply_preview TEXT,
  reply_author  TEXT,
  deleted      BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  created_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_gcm_group_id ON public.group_chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_gcm_created ON public.group_chat_messages(group_id, created_date);

-- 3. RLS — open policies (auth is handled at app level)
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_study_groups" ON public.study_groups;
CREATE POLICY "open_study_groups" ON public.study_groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_group_chat_messages" ON public.group_chat_messages;
CREATE POLICY "open_group_chat_messages" ON public.group_chat_messages FOR ALL USING (true) WITH CHECK (true);

-- 4. Reload PostgREST schema cache so REST API recognises the new tables immediately
NOTIFY pgrst, 'reload schema';

SELECT 'Tables created successfully' AS result;
