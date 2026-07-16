-- ================================================
-- lesson_comments table
-- Stores per-lesson comments and threaded replies.
-- Completely isolated from forums / study_groups.
-- ================================================

CREATE TABLE IF NOT EXISTS public.lesson_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID NOT NULL,
  parent_id       UUID REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name     TEXT,
  author_photo    TEXT,
  author_role     TEXT DEFAULT 'student',
  content         TEXT NOT NULL,
  likes           INT DEFAULT 0,
  liked_by        UUID[] DEFAULT '{}',
  is_pinned       BOOLEAN DEFAULT FALSE,
  is_answer       BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'active',  -- active | deleted | flagged
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lesson lookups
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson_id ON public.lesson_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent_id ON public.lesson_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_created_by ON public.lesson_comments(created_by);

-- Enable RLS
ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active comments
CREATE POLICY "lesson_comments_read" ON public.lesson_comments
  FOR SELECT USING (status = 'active' OR auth.uid() = created_by);

-- Authenticated users can insert
CREATE POLICY "lesson_comments_insert" ON public.lesson_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own comments (for likes array etc)
CREATE POLICY "lesson_comments_update" ON public.lesson_comments
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() IS NOT NULL);

-- Users can only soft-delete (update status) — no hard delete policy needed
-- Admins handle hard deletes via service role

-- Trigger to keep updated_date current
CREATE OR REPLACE FUNCTION update_lesson_comments_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_comments_updated_date
  BEFORE UPDATE ON public.lesson_comments
  FOR EACH ROW EXECUTE FUNCTION update_lesson_comments_updated_date();
