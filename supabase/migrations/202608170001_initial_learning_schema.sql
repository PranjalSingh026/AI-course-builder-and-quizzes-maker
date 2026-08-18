-- AsterLearn: user-owned learning content, assessment attempts, and results.
-- Run this migration in the Supabase SQL Editor (or with the Supabase CLI).

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal text not null,
  title text not null,
  description text not null,
  level text not null default 'Beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text not null,
  objectives jsonb not null default '[]'::jsonb,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lesson_completions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  source_type text not null check (source_type in ('lesson', 'topic_practice')),
  topic text,
  title text not null,
  question_count integer not null check (question_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null check (position > 0),
  question text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (quiz_id, position),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  score integer not null default 0,
  total_questions integer not null check (total_questions > 0),
  revealed_answer_count integer not null default 0 check (revealed_answer_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score <= total_questions),
  check (revealed_answer_count <= total_questions)
);

create table public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  quiz_question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_answer text,
  solution_viewed boolean not null default false,
  is_correct boolean not null default false,
  points_awarded integer not null default 0 check (points_awarded between 0 and 1),
  answered_at timestamptz not null default now(),
  unique (attempt_id, quiz_question_id)
);

create index courses_owner_created_idx on public.courses (owner_id, created_at desc);
create index lessons_course_position_idx on public.lessons (course_id, position);
create index quizzes_owner_created_idx on public.quizzes (owner_id, created_at desc);
create index quiz_questions_quiz_position_idx on public.quiz_questions (quiz_id, position);
create index quiz_attempts_user_completed_idx on public.quiz_attempts (user_id, completed_at desc);
create index quiz_attempt_answers_attempt_idx on public.quiz_attempt_answers (attempt_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Learner'));
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons for each row execute function public.set_updated_at();
create trigger quizzes_set_updated_at before update on public.quizzes for each row execute function public.set_updated_at();
create trigger quiz_attempts_set_updated_at before update on public.quiz_attempts for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;

create policy "Users manage their profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage their courses" on public.courses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Users manage lessons in their courses" on public.lessons for all using (exists (select 1 from public.courses where courses.id = lessons.course_id and courses.owner_id = auth.uid())) with check (exists (select 1 from public.courses where courses.id = lessons.course_id and courses.owner_id = auth.uid()));
create policy "Users manage their lesson completions" on public.lesson_completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their quizzes" on public.quizzes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Users manage questions in their quizzes" on public.quiz_questions for all using (exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.owner_id = auth.uid())) with check (exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.owner_id = auth.uid()));
create policy "Users manage their quiz attempts" on public.quiz_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage answers in their attempts" on public.quiz_attempt_answers for all using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.quiz_attempts where quiz_attempts.id = quiz_attempt_answers.attempt_id and quiz_attempts.user_id = auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
