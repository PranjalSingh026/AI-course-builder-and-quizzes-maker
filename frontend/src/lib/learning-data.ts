import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type StoredLesson = { id: string; title: string; summary: string; objectives: string[]; position: number };
export type StoredCourse = { id: string; goal: string; title: string; description: string; level: string; lessons: StoredLesson[] };
export type QuizQuestion = { question: string; options: string[]; correct_answer: string; explanation: string };

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function ensureLearningUser(): Promise<User> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  throwIfError(sessionError);
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  throwIfError(error);
  if (!data.user) throw new Error("Unable to start a learning session.");
  return data.user;
}

export async function loadLatestCourse(userId: string): Promise<{ course: StoredCourse | null; completedLessonIds: string[] }> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id, goal, title, description, level, lessons(id, title, summary, objectives, position)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(courseError);

  const { data: completions, error: completionError } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("user_id", userId);
  throwIfError(completionError);

  const completedLessonIds = (completions ?? []).map((completion) => completion.lesson_id);
  if (!courseRow) return { course: null, completedLessonIds };

  return {
    course: {
      ...courseRow,
      lessons: [...(courseRow.lessons ?? [])].sort((a, b) => a.position - b.position).map((lesson) => ({ ...lesson, objectives: lesson.objectives as string[] })),
    },
    completedLessonIds,
  };
}

export async function saveCourse(userId: string, course: Omit<StoredCourse, "id" | "lessons"> & { lessons: Omit<StoredLesson, "id">[] }): Promise<StoredCourse> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .insert({ owner_id: userId, goal: course.goal, title: course.title, description: course.description, level: course.level })
    .select("id, goal, title, description, level")
    .single();
  throwIfError(courseError);
  if (!courseRow) throw new Error("Failed to create course.");

  const { data: lessonRows, error: lessonError } = await supabase
    .from("lessons")
    .insert(course.lessons.map((lesson, index) => ({ course_id: courseRow.id, title: lesson.title, summary: lesson.summary, objectives: lesson.objectives, position: index + 1 })))
    .select("id, title, summary, objectives, position");
  throwIfError(lessonError);

  return { ...courseRow, lessons: [...(lessonRows ?? [])].sort((a, b) => a.position - b.position).map((lesson) => ({ ...lesson, objectives: lesson.objectives as string[] })) };
}

export async function completeLesson(userId: string, lessonId: string) {
  const { error } = await supabase.from("lesson_completions").upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
  throwIfError(error);
}

export async function saveQuizResult(input: {
  userId: string;
  title: string;
  topic?: string;
  sourceType: "lesson" | "topic_practice";
  courseId?: string;
  lessonId?: string;
  questions: QuizQuestion[];
  answers: Record<number, string>;
  revealedAnswerIndexes: number[];
  score: number;
}) {
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({ owner_id: input.userId, course_id: input.courseId ?? null, lesson_id: input.lessonId ?? null, source_type: input.sourceType, topic: input.topic ?? null, title: input.title, question_count: input.questions.length })
    .select("id")
    .single();
  throwIfError(quizError);
  if (!quiz) throw new Error("Failed to create quiz.");

  const { data: savedQuestions, error: questionError } = await supabase
    .from("quiz_questions")
    .insert(input.questions.map((question, index) => ({ quiz_id: quiz.id, position: index + 1, question: question.question, options: question.options, correct_answer: question.correct_answer, explanation: question.explanation })))
    .select("id, position");
  throwIfError(questionError);

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({ user_id: input.userId, quiz_id: quiz.id, status: "completed", score: input.score, total_questions: input.questions.length, revealed_answer_count: input.revealedAnswerIndexes.length, completed_at: new Date().toISOString() })
    .select("id")
    .single();
  throwIfError(attemptError);
  if (!attempt) throw new Error("Failed to create quiz attempt.");

  const questionIds = new Map((savedQuestions ?? []).map((question) => [question.position, question.id]));
  const { error: answerError } = await supabase.from("quiz_attempt_answers").insert(input.questions.map((question, index) => {
    const solutionViewed = input.revealedAnswerIndexes.includes(index);
    const isCorrect = input.answers[index] === question.correct_answer;
    return { user_id: input.userId, attempt_id: attempt.id, quiz_question_id: questionIds.get(index + 1), selected_answer: input.answers[index] ?? null, solution_viewed: solutionViewed, is_correct: isCorrect, points_awarded: Number(isCorrect && !solutionViewed) };
  }));
  throwIfError(answerError);
}

export type CourseWithProgress = StoredCourse & { completedCount: number; totalLessons: number };

export async function loadAllCourses(userId: string): Promise<CourseWithProgress[]> {
  // Query courses with lessons
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, goal, title, description, level, created_at, lessons(id, title, summary, objectives, position)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  throwIfError(error);

  // Query all lesson completions for this user
  const { data: completions, error: completionError } = await supabase
    .from('lesson_completions')
    .select('lesson_id')
    .eq('user_id', userId);
  throwIfError(completionError);

  const completedSet = new Set((completions ?? []).map(c => c.lesson_id));

  return (courses ?? []).map(course => {
    const lessons = [...(course.lessons ?? [])].sort((a, b) => a.position - b.position).map(l => ({ ...l, objectives: l.objectives as string[] }));
    const completedCount = lessons.filter(l => completedSet.has(l.id)).length;
    return { ...course, lessons, completedCount, totalLessons: lessons.length };
  });
}

export type QuizHistoryItem = {
  attemptId: string;
  quizId: string;
  title: string;
  topic: string | null;
  sourceType: string;
  score: number;
  totalQuestions: number;
  revealedAnswerCount: number;
  completedAt: string | null;
  difficulty: string;
};

export async function loadQuizHistory(userId: string): Promise<QuizHistoryItem[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id, quiz_id, score, total_questions, revealed_answer_count, completed_at, status, quizzes(title, topic, source_type, difficulty)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  throwIfError(error);

  return (data ?? []).map(attempt => ({
    attemptId: attempt.id,
    quizId: attempt.quiz_id,
    title: (attempt.quizzes as any)?.title ?? 'Untitled Quiz',
    topic: (attempt.quizzes as any)?.topic ?? null,
    sourceType: (attempt.quizzes as any)?.source_type ?? 'unknown',
    score: attempt.score,
    totalQuestions: attempt.total_questions,
    revealedAnswerCount: attempt.revealed_answer_count,
    completedAt: attempt.completed_at,
    difficulty: (attempt.quizzes as any)?.difficulty ?? 'medium',
  }));
}

