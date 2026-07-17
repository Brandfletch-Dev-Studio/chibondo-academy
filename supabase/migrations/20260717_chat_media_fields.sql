-- ============================================================
-- Migration: Chat media + voice note fields
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Add message type field (text | voice | image | document)
ALTER TABLE group_chat_messages
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'text';

-- Add media fields for voice notes, images, documents
ALTER TABLE group_chat_messages
  ADD COLUMN IF NOT EXISTS voice_url   text,
  ADD COLUMN IF NOT EXISTS media_url   text,
  ADD COLUMN IF NOT EXISTS media_name  text,
  ADD COLUMN IF NOT EXISTS media_size  bigint;

-- Backfill existing messages as type 'text'
UPDATE group_chat_messages SET type = 'text' WHERE type IS NULL;

-- NOTE: Create a public storage bucket called 'chat-media' in
-- Supabase Dashboard > Storage > New Bucket
-- Name: chat-media
-- Public: YES (so media URLs work without auth)
-- File size limit: 50MB
-- Allowed MIME types: audio/*, image/*, application/pdf,
--   application/msword, application/vnd.openxmlformats-officedocument.*

SELECT 'Migration complete ✓' as result;
