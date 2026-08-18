-- Add difficulty level to quizzes (easy / medium / hard).
-- Run this migration in the Supabase SQL Editor.

ALTER TABLE public.quizzes
  ADD COLUMN difficulty text NOT NULL DEFAULT 'medium'
  CHECK (difficulty IN ('easy', 'medium', 'hard'));
