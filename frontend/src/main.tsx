import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertCircle, BarChart3, Bell, BookOpen, BrainCircuit, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Compass, ExternalLink, Home, Lock, LogIn, LogOut, Mail, Menu, PlayCircle, Plus, Sparkles, Target, Trophy, User, UserPlus, X } from "lucide-react";
import { completeLesson, ensureLearningUser, loadLatestCourse, saveCourse as persistCourse, saveQuizResult } from "./lib/learning-data";
import type { CourseWithProgress, QuizHistoryItem } from "./lib/learning-data";
import { loadAllCourses, loadQuizHistory } from "./lib/learning-data";
import { supabase } from "./lib/supabase";
import "./styles.css";

type Notification = { id: number; message: string; timestamp: Date; read: boolean };

type CoursePreview = { id?: string; goal?: string; title: string; description: string; level: string; lessons: { id?: string; title: string; summary: string; objectives: string[]; position?: number }[] };
type Lesson = CoursePreview["lessons"][number];
type Quiz = { title: string; questions: { question: string; options: string[]; correct_answer: string; explanation: string }[] };

function App() {
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [lessonCount, setLessonCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CoursePreview | null>(null);
  const [savedCourse, setSavedCourse] = useState<CoursePreview | null>(() => {
    try { return JSON.parse(window.localStorage.getItem("asterlearn-course") || "null") as CoursePreview | null; }
    catch { return null; }
  });
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("asterlearn-completed-lessons") || "[]") as string[]; }
    catch { return []; }
  });
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState("");
  const [practiceQuiz, setPracticeQuiz] = useState<Quiz | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<number[]>([]);
  const [practiceScore, setPracticeScore] = useState<number | null>(null);
  const [practiceStage, setPracticeStage] = useState<"quiz" | "complete" | "results">("quiz");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const builderRef = useRef<HTMLElement>(null);
  const learningRef = useRef<HTMLElement>(null);
  const quizRef = useRef<HTMLElement>(null);

  /* ── Auth System State ── */
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  /* ── Mobile Menu State ── */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /* ── NEW: Quiz difficulty ── */
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  /* ── NEW: Next-question sequential flow ── */
  const [practiceSeqMode, setPracticeSeqMode] = useState(false);
  const [practiceSeqIndex, setPracticeSeqIndex] = useState(0);

  /* ── NEW: My Learning page data ── */
  const [allCourses, setAllCourses] = useState<CourseWithProgress[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [learningLoaded, setLearningLoaded] = useState(false);

  /* ── Notification system ── */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifIdRef = useRef(0);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const pushNotice = useCallback((message: string) => {
    if (!message) return;
    const id = ++notifIdRef.current;
    setNotifications(prev => [{ id, message, timestamp: new Date(), read: false }, ...prev]);
    setNotice(message);
    /* Auto-dismiss toast after 4 seconds */
    setTimeout(() => setNotice(prev => prev === message ? "" : prev), 4000);
  }, []);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
    setShowNotifPanel(false);
  }

  /* Close notification panel on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    }
    if (showNotifPanel) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showNotifPanel]);

  useEffect(() => {
    async function loadLearningData() {
      try {
        const user = await ensureLearningUser();
        setUserId(user.id);
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (sbUser && !sbUser.is_anonymous) {
          setAuthUser(sbUser);
        }
        const { course, completedLessonIds } = await loadLatestCourse(user.id);
        if (course) setSavedCourse(course);
        setCompletedLessons(completedLessonIds);
      } catch (error) {
        pushNotice(error instanceof Error ? `Supabase data could not be loaded: ${error.message}` : "Supabase data could not be loaded.");
      }
    }
    void loadLearningData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !session.user.is_anonymous) {
        setAuthUser(session.user);
        setUserId(session.user.id);
      } else if (_event === "SIGNED_OUT") {
        setAuthUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!cleanEmail || !authPassword.trim()) {
      setAuthError("Please fill in all fields.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: authPassword,
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password. Please check your credentials or register if you don't have an account.");
        }
        if (error.message.includes("Email not confirmed")) {
          throw new Error("Please check your email inbox to confirm your account before signing in.");
        }
        throw error;
      }
      if (data.user) {
        setAuthUser(data.user);
        setUserId(data.user.id);
        setShowAuthModal(false);
        setAuthEmail("");
        setAuthPassword("");
        pushNotice(`Welcome back, ${data.user.email}!`);
        const { course, completedLessonIds } = await loadLatestCourse(data.user.id);
        if (course) setSavedCourse(course);
        setCompletedLessons(completedLessonIds);
        if (activeNav === "My learning") void loadMyLearningData();
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!cleanEmail || !authPassword.trim()) {
      setAuthError("Please fill in all fields.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: authPassword,
        options: {
          data: { full_name: authName.trim() }
        }
      });
      if (error) throw error;

      /* If user already exists in Supabase, identities array will be empty */
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setAuthError("This email address is already registered. Please log in instead.");
        setAuthMode("login");
        return;
      }

      /* If session established immediately */
      if (data.session && data.user) {
        setAuthUser(data.user);
        setUserId(data.user.id);
        setShowAuthModal(false);
        setAuthEmail("");
        setAuthPassword("");
        setAuthName("");
        pushNotice(`Account created successfully! Welcome to AsterLearn.`);
        const { course, completedLessonIds } = await loadLatestCourse(data.user.id);
        if (course) setSavedCourse(course);
        setCompletedLessons(completedLessonIds);
        if (activeNav === "My learning") void loadMyLearningData();
      } else {
        /* Attempt instant login to create session if email auto-confirm is enabled */
        const loginRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authPassword,
        });
        if (loginRes.data?.user) {
          setAuthUser(loginRes.data.user);
          setUserId(loginRes.data.user.id);
          setShowAuthModal(false);
          setAuthEmail("");
          setAuthPassword("");
          setAuthName("");
          pushNotice(`Account created successfully! Welcome to AsterLearn.`);
          const { course, completedLessonIds } = await loadLatestCourse(loginRes.data.user.id);
          if (course) setSavedCourse(course);
          setCompletedLessons(completedLessonIds);
          if (activeNav === "My learning") void loadMyLearningData();
        } else {
          pushNotice("Account created! Check your email inbox to confirm your email before signing in.");
          setAuthMode("login");
          setAuthError("Account created! Please check your email inbox to confirm your account before logging in.");
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Registration failed. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setAuthUser(null);
      const guestUser = await ensureLearningUser();
      setUserId(guestUser.id);
      pushNotice("Signed out of your account.");
    } catch (err: any) {
      pushNotice("Error signing out: " + err.message);
    }
  }

  /* ── CHANGED: page-based routing instead of scroll ── */
  function goTo(item: string) {
    setActiveNav(item);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (item === "My learning" && userId) {
      void loadMyLearningData();
    }
  }

  /* ── NEW: load My Learning data from Supabase ── */
  async function loadMyLearningData() {
    if (!userId) return;
    try {
      const [courses, history] = await Promise.all([
        loadAllCourses(userId),
        loadQuizHistory(userId),
      ]);
      setAllCourses(courses);
      setQuizHistory(history);
      setLearningLoaded(true);
    } catch (error) {
      pushNotice(error instanceof Error ? `Could not load learning data: ${error.message}` : "Could not load learning data.");
    }
  }

  async function saveCourse() {
    if (!preview) return;
    if (!userId) { pushNotice("Preparing your secure learning account. Please try saving again in a moment."); return; }
    try {
      const lessonsToSave = preview.lessons.map((lesson, idx) => ({ title: lesson.title, summary: lesson.summary, objectives: lesson.objectives, position: lesson.position ?? (idx + 1) }));
      const saved = await persistCourse(userId, { goal, title: preview.title, description: preview.description, level: preview.level, lessons: lessonsToSave });
      window.localStorage.setItem("asterlearn-course", JSON.stringify(saved));
      setSavedCourse(saved);
      pushNotice("Course saved securely to your learning library.");
    } catch (error) {
      pushNotice(error instanceof Error ? `Course could not be saved: ${error.message}` : "Course could not be saved to Supabase.");
    }
  }

  function openLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setQuiz(null); setAnswers({}); setQuizScore(null);
    window.setTimeout(() => document.getElementById("lesson-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function markLessonComplete() {
    if (!selectedLesson) return;
    if (!userId || !selectedLesson.id) { pushNotice("Save the course first, then lesson progress can be stored securely."); return; }
    try {
      await completeLesson(userId, selectedLesson.id);
    } catch (error) {
      pushNotice(error instanceof Error ? `Lesson progress could not be saved: ${error.message}` : "Lesson progress could not be saved.");
      return;
    }
    const updated = Array.from(new Set([...completedLessons, selectedLesson.id]));
    window.localStorage.setItem("asterlearn-completed-lessons", JSON.stringify(updated));
    setCompletedLessons(updated);
    pushNotice("Lesson marked complete and saved securely.");
  }

  async function generateLessonQuiz() {
    if (!selectedLesson) return;
    setQuizLoading(true); setNotice("");
    const api = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
    try {
      /* CHANGED: now sends difficulty */
      const response = await fetch(`${api}/quizzes/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lesson_title: selectedLesson.title, lesson_summary: selectedLesson.summary, objectives: selectedLesson.objectives, question_count: 5, difficulty }) });
      if (!response.ok) throw new Error("Gemini could not generate this quiz. Please try again.");
      setQuiz(await response.json()); setAnswers({}); setQuizScore(null);
    } catch (error) { pushNotice(error instanceof Error ? error.message : "Quiz generation could not be reached."); }
    finally { setQuizLoading(false); }
  }

  async function generateTopicQuiz() {
    const topic = practiceTopic.trim();
    if (topic.length < 3) { pushNotice("Enter a topic with at least 3 characters to start practice."); return; }
    setPracticeLoading(true); setNotice("");
    const api = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
    try {
      /* CHANGED: now sends difficulty */
      const response = await fetch(`${api}/quizzes/topic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, question_count: 10, difficulty }) });
      if (!response.ok) throw new Error("A quiz could not be generated for this topic. Please try again.");
      setPracticeQuiz(await response.json());
      setPracticeAnswers({}); setRevealedAnswers([]); setPracticeScore(null); setPracticeStage("quiz");
      setPracticeSeqMode(false); setPracticeSeqIndex(0);
    } catch (error) { pushNotice(error instanceof Error ? error.message : "Quiz generation could not be reached."); }
    finally { setPracticeLoading(false); }
  }

  async function finishPractice() {
    if (!practiceQuiz) return;
    /* In sequential mode, check all answered up to current index */
    if (practiceSeqMode) {
      const answeredCount = Object.keys(practiceAnswers).length;
      if (answeredCount < practiceQuiz.questions.length) { pushNotice("Please answer every question before finishing practice."); return; }
    } else {
      if (Object.keys(practiceAnswers).length !== practiceQuiz.questions.length) { pushNotice("Please answer every question before finishing practice."); return; }
    }
    const score = practiceQuiz.questions.reduce((total, question, index) => total + Number(practiceAnswers[index] === question.correct_answer && !revealedAnswers.includes(index)), 0);
    setPracticeScore(score); setPracticeStage("complete");
    if (!userId) { pushNotice("Your result is ready, but the secure learning account is still loading."); return; }
    try {
      await saveQuizResult({ userId, title: practiceQuiz.title, topic: practiceTopic.trim(), sourceType: "topic_practice", questions: practiceQuiz.questions, answers: practiceAnswers, revealedAnswerIndexes: revealedAnswers, score });
    } catch (error) {
      pushNotice(error instanceof Error ? `Result could not be saved: ${error.message}` : "Result could not be saved to Supabase.");
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    if (Object.keys(answers).length !== quiz.questions.length) { pushNotice("Please answer every question before submitting."); return; }
    const score = quiz.questions.reduce((total, question, index) => total + Number(answers[index] === question.correct_answer), 0);
    setQuizScore(score);
    if (!userId) return;
    try {
      await saveQuizResult({ userId, title: quiz.title, sourceType: "lesson", courseId: savedCourse?.id, lessonId: selectedLesson?.id, questions: quiz.questions, answers, revealedAnswerIndexes: [], score });
    } catch (error) {
      pushNotice(error instanceof Error ? `Lesson quiz result could not be saved: ${error.message}` : "Lesson quiz result could not be saved to Supabase.");
    }
  }

  /* ── NEW: Start sequential practice ("Next Question" mode) ── */
  async function startSeqPractice() {
    const topic = practiceTopic.trim();
    if (topic.length < 3) { pushNotice("Enter a topic with at least 3 characters to start practice."); return; }
    setPracticeLoading(true); setNotice("");
    const api = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
    try {
      const response = await fetch(`${api}/quizzes/topic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, question_count: 10, difficulty }) });
      if (!response.ok) throw new Error("A quiz could not be generated for this topic. Please try again.");
      setPracticeQuiz(await response.json());
      setPracticeAnswers({}); setRevealedAnswers([]); setPracticeScore(null); setPracticeStage("quiz");
      setPracticeSeqMode(true); setPracticeSeqIndex(0);
    } catch (error) { pushNotice(error instanceof Error ? error.message : "Quiz generation could not be reached."); }
    finally { setPracticeLoading(false); }
  }

  function videoSearch(topic: string) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} tutorial for beginners`)}`;
  }

  async function createCourse() {
    if (goal.trim().length < 8) { pushNotice("Please describe a learning goal in a little more detail."); return; }
    setLoading(true); setNotice("");
    const api = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
    try {
      const response = await fetch(`${api}/courses/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal, level, lesson_count: lessonCount }) });
      if (!response.ok) {
        if (response.status === 502) throw new Error("Gemini could not generate this course. Check that your API key is valid and try again.");
        throw new Error("Course generation could not be completed. Please try again.");
      }
      setPreview(await response.json());
    } catch (error) {
      pushNotice(error instanceof Error ? error.message : "Course generation could not be reached. Please try again in a moment.");
    } finally { setLoading(false); }
  }

  /* ── Reusable lesson reader + course builder blocks ── */
  const courseBuilderBlock = <>
    <section className="hero-grid" ref={builderRef}>
      <div className="create-card"><div className="card-label"><Sparkles size={17}/> AI COURSE BUILDER</div><h2>What do you want to master?</h2><p>Tell AsterLearn your goal. It will create a structured, personalized path.</p><textarea value={goal} onChange={e => setGoal(e.target.value)} aria-label="Learning goal" />
        <div className="controls"><label>Level<select value={level} onChange={e => setLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Lessons<select value={lessonCount} onChange={e => setLessonCount(Number(e.target.value))}><option value={3}>3 lessons</option><option value={4}>4 lessons</option><option value={5}>5 lessons</option><option value={6}>6 lessons</option></select></label><button className="primary" onClick={createCourse} disabled={loading}>{loading ? "Creating path..." : <><Sparkles size={17}/> Generate course</>}</button></div>
        {notice && <p className="notice">{notice}</p>}
      </div>
      <div className="streak-card"><div className="streak-icon">🚀</div><p>YOUR JOURNEY</p><strong>0 <small>days</small></strong><div className="week"><i/><i/><i/><i/><i/><i/><i/></div><span>Your learning streak begins with your first completed lesson.</span></div>
    </section>

    {preview && <section className="generated"><div><p className="eyebrow">YOUR GENERATED LEARNING PATH</p><h2>{preview.title}</h2><p>{preview.description}</p></div><button className="outline" onClick={saveCourse}>Save course <ChevronRight size={17}/></button><div className="lesson-list">{preview.lessons.map((lesson, index) => <article key={lesson.title} role="button" tabIndex={0} onClick={() => openLesson(lesson)} onKeyDown={event => { if (event.key === "Enter") openLesson(lesson); }}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{lesson.title}</b><p>{lesson.summary}</p><small>{lesson.objectives[0]}</small></div><ChevronRight size={20}/></article>)}</div></section>}
    {selectedLesson && <section className="lesson-reader" id="lesson-reader"><button className="text-button" onClick={() => setSelectedLesson(null)}>← Back to course</button><p className="eyebrow">LESSON READER</p><h2>{selectedLesson.title}</h2><p className="lesson-summary">{selectedLesson.summary}</p><h3>What you will learn</h3><ul>{selectedLesson.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul><div className="resource-block"><div><p className="eyebrow">VIDEO RESOURCES</p><h3>Learn with video tutorials</h3><p>Open YouTube results tailored to this lesson and choose the explanation that works best for you.</p></div><a className="video-link" href={videoSearch(selectedLesson.title)} target="_blank" rel="noreferrer"><PlayCircle size={20}/> Find videos on YouTube <ExternalLink size={15}/></a></div><div className="lesson-actions"><button className="primary" onClick={markLessonComplete}>{completedLessons.includes(selectedLesson.title) ? "✓ Lesson completed" : "Mark lesson complete"}</button><button className="outline" onClick={generateLessonQuiz} disabled={quizLoading}>{quizLoading ? "Creating quiz..." : "Generate lesson quiz"}</button></div>{quiz && <section className="quiz-panel"><p className="eyebrow">AI-GENERATED QUIZ</p><h3>{quiz.title}</h3>{quiz.questions.map((question, index) => <article className="quiz-question" key={question.question}><b>{index + 1}. {question.question}</b>{question.options.map(option => <label key={option} className={answers[index] === option ? "selected-option" : ""}><input type="radio" name={`question-${index}`} checked={answers[index] === option} onChange={() => setAnswers({ ...answers, [index]: option })}/>{option}</label>)}{quizScore !== null && <p className={answers[index] === question.correct_answer ? "correct" : "incorrect"}>{answers[index] === question.correct_answer ? "Correct" : `Correct answer: ${question.correct_answer}`} — {question.explanation}</p>}</article>)}{quizScore === null ? <button className="primary" onClick={submitQuiz}>Submit quiz</button> : <div className="quiz-result"><b>Score: {quizScore} / {quiz.questions.length}</b><p>Review the explanations above, then continue with your next lesson.</p></div>}</section>}</section>}
  </>;

  return <div className="app-shell">
    {isMobileMenuOpen && (
      <div 
        className="mobile-overlay" 
        onClick={() => setIsMobileMenuOpen(false)}
        aria-label="Close menu"
      />
    )}
    <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
      <div className="brand">
        <span className="brand-mark"><BrainCircuit size={21}/></span>
        <span>Aster<span>Learn</span></span>
        <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
          <X size={20} />
        </button>
      </div>
      <nav>
        <button className={activeNav === "Dashboard" ? "active" : ""} onClick={() => goTo("Dashboard")}><Home size={19}/>Dashboard</button>
        <button className={activeNav === "My learning" ? "active" : ""} onClick={() => goTo("My learning")}><BookOpen size={19}/>My learning</button>
        <button className={activeNav === "Create course" ? "active" : ""} onClick={() => goTo("Create course")}><Plus size={19}/>Create course</button>
        <button className={activeNav === "Quizzes" ? "active" : ""} onClick={() => goTo("Quizzes")}><Compass size={19}/>Quizzes</button>
        <button className={activeNav === "Analytics" ? "active" : ""} onClick={() => goTo("Analytics")}><BarChart3 size={19}/>Analytics</button>
      </nav>
      <div className="upgrade"><Sparkles size={18}/><b>Your learning space</b><p>Every course and recommendation will belong to your account.</p><button onClick={() => { if (!authUser) { setAuthMode("register"); setAuthError(""); setShowAuthModal(true); } else { goTo("Create course"); } }}>{authUser ? "Create a course" : "Sign up for free"}</button></div>
      <div
        className={`profile ${!authUser ? "profile-clickable" : ""}`}
        onClick={() => {
          if (!authUser) {
            setAuthMode("login");
            setAuthError("");
            setShowAuthModal(true);
          }
        }}
      >
        <div className="avatar">
          {authUser
            ? (authUser.user_metadata?.full_name
                ? authUser.user_metadata.full_name.slice(0, 2).toUpperCase()
                : authUser.email.slice(0, 2).toUpperCase())
            : "G"}
        </div>
        <div className="profile-info">
          <b>
            {authUser
              ? authUser.user_metadata?.full_name || authUser.email.split("@")[0]
              : "Guest Account"}
          </b>
          <small>
            {authUser ? (
              authUser.email
            ) : (
              <><LogIn size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Click to Sign In / Register</>
            )}
          </small>
        </div>
        {authUser && (
          <button className="signout-btn" title="Sign Out" onClick={(e) => { e.stopPropagation(); void handleSignOut(); }}>
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
    <main>
      <div className="mobile-header">
        <div className="brand mobile-only">
          <span className="brand-mark"><BrainCircuit size={21}/></span>
          <span>Aster<span>Learn</span></span>
        </div>
        <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      {/* ════════════════════════════════════════════════ */}
      {/* PAGE: Dashboard                                 */}
      {/* ════════════════════════════════════════════════ */}
      {activeNav === "Dashboard" && <>
      <header>
        <div>
          <p className="eyebrow">YOUR PERSONAL LEARNING COMMAND CENTER</p>
          <h1>
            Welcome back, {authUser ? (authUser.user_metadata?.full_name || authUser.email.split("@")[0]) : "Learner"}! <span>✦</span>
          </h1>
          <p className="subtitle">Track your progress, explore new AI skills, and jump right back into your learning journey.</p>
        </div>
        <div className="notif-wrapper" ref={notifPanelRef}>
          <button className="bell" aria-label="Notifications" onClick={() => { setShowNotifPanel(prev => !prev); if (!showNotifPanel) markAllRead(); }}>
            <Bell size={18}/>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          {showNotifPanel && <div className="notif-panel">
            <div className="notif-header"><b>Notifications</b>{notifications.length > 0 && <button className="text-button" onClick={clearNotifications}>Clear all</button>}</div>
            {notifications.length === 0
              ? <div className="notif-empty"><Bell size={24}/><p>No notifications yet</p><small>Actions like saving courses, completing lessons, and quiz results will appear here.</small></div>
              : <div className="notif-list">{notifications.map(n => <div className={`notif-item ${n.read ? "" : "notif-unread"}`} key={n.id}><p>{n.message}</p><small>{n.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div>
            }
          </div>}
        </div>
      </header>

      {/* ── 1. AI Cyber-Hub Hero & Prompt Search ── */}
      <section className="cyber-hub-wrapper">
        <div className="cyber-eyebrow">
          <Sparkles size={13} /> AI CYBER LEARNING HUB
        </div>
        <h2 className="cyber-hub-title">What skill do you want to master today?</h2>
        <p className="cyber-hub-subtitle">Type any topic or learning goal below to generate a custom AI course or launch an instant topic assessment.</p>

        <div className="cyber-search-box">
          <input
            type="text"
            value={goal}
            onChange={(e) => { setGoal(e.target.value); setPracticeTopic(e.target.value); }}
            placeholder="Search what you want to learn today..."
            aria-label="Search learning goal or topic"
          />
          <div className="cyber-search-actions">
            <button className="primary cyber-btn-violet" onClick={() => { goTo("Create course"); void createCourse(); }}>
              <Sparkles size={16} /> Build AI Course
            </button>
            <button className="outline cyber-btn-cyan" onClick={() => { goTo("Quizzes"); void generateTopicQuiz(); }}>
              <Compass size={16} /> Practice Quiz
            </button>
          </div>
        </div>

        {/* Interactive Neon Skill Matrix */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", color: "#a78bfa", textTransform: "uppercase", margin: "0 0 10px" }}>
            POPULAR AI LEARNING PATHS
          </p>
          <div className="cyber-chips-row">
            {[
              { label: "💻 Web Development", topic: "React & Node.js web development" },
              { label: "🤖 Machine Learning & AI", topic: "Machine learning algorithms and neural networks" },
              { label: "🗄️ DBMS & SQL Joins", topic: "Database management systems and SQL queries" },
              { label: "⚡ Data Structures & Algorithms", topic: "Data structures and algorithm design" },
              { label: "🛡️ Cyber Security & Cloud", topic: "Cybersecurity fundamentals and cloud architecture" },
              { label: "📊 Data Science & Python", topic: "Data analysis and visualization with Python" },
            ].map(chip => (
              <button
                key={chip.label}
                className="cyber-chip"
                onClick={() => {
                  setGoal(chip.topic);
                  setPracticeTopic(chip.topic);
                  pushNotice(`Selected: ${chip.label}. Click "Build AI Course" or "Practice Quiz" to start!`);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Glowing Cyber Stats Cards ── */}
      <section className="cyber-stats-grid">
        <article className="cyber-stat-card">
          <div className="cyber-stat-icon cyber-icon-violet"><BookOpen size={22} /></div>
          <div className="cyber-stat-info">
            <b>{allCourses.length || (savedCourse ? 1 : 0)}</b>
            <span>Saved Courses</span>
          </div>
        </article>
        <article className="cyber-stat-card">
          <div className="cyber-stat-icon cyber-icon-emerald"><CheckCircle2 size={22} /></div>
          <div className="cyber-stat-info">
            <b>{completedLessons.length}</b>
            <span>Completed Lessons</span>
          </div>
        </article>
        <article className="cyber-stat-card">
          <div className="cyber-stat-icon cyber-icon-cyan"><Trophy size={22} /></div>
          <div className="cyber-stat-info">
            <b>{quizHistory.length}</b>
            <span>Quizzes Taken</span>
          </div>
        </article>
        <article className="cyber-stat-card">
          <div className="cyber-stat-icon cyber-icon-pink"><Clock3 size={22} /></div>
          <div className="cyber-stat-info">
            <b>{completedLessons.length > 0 ? "3 Days" : "1 Day"}</b>
            <span>Learning Streak</span>
          </div>
        </article>
      </section>

      {/* ── 3. Udemy-Style Featured "Continue Learning" & Saved Courses ── */}
      {(() => {
        const activeCourse = savedCourse || (allCourses.length > 0 ? allCourses[0] : null);
        if (!activeCourse) {
          return (
            <section className="learning-grid" ref={learningRef}>
              <article className="continue-card">
                <div className="course-top"><span className="course-icon">＋</span><span className="pill">GET STARTED</span></div>
                <p className="eyebrow">NO ACTIVE COURSE YET</p>
                <h3>Build your first learning path</h3>
                <p className="next"><Clock3 size={16}/> It takes less than a minute to create an AI-powered course.</p>
                <button className="primary full" onClick={() => goTo("Create course")}>Create My First Course <ChevronRight size={17}/></button>
              </article>
              <article className="recommendation">
                <div className="recommendation-head"><span className="ai-badge"><BrainCircuit size={18}/></span><span>AI PRACTICE HUB</span></div>
                <h3>Test your skills with instant assessments</h3>
                <p>Select any topic or pick from practice quizzes to measure your knowledge and identify areas for improvement.</p>
                <div className="weak-chip"><Target size={16}/> Ready for your first assessment</div>
                <button className="outline full" onClick={() => goTo("Quizzes")}>Start Practising Quizzes <ChevronRight size={17}/></button>
              </article>
            </section>
          );
        }

        const totalL = activeCourse.lessons?.length || 0;
        const pct = totalL > 0 ? Math.round((completedLessons.length / totalL) * 100) : 0;

        return (
          <section className="continue-learning-card">
            <div className="cl-header">
              <span className="cl-badge">CONTINUE LEARNING</span>
              <span className="pill">{activeCourse.level.toUpperCase()} LEVEL</span>
            </div>
            <h3 style={{ fontSize: 22, margin: "6px 0", color: "#0f172a" }}>{activeCourse.title}</h3>
            <p style={{ color: "#64748b", fontSize: 13.5, margin: "0 0 14px", lineHeight: 1.5 }}>{activeCourse.description}</p>
            
            <div className="cl-progress-bar">
              <div className="cl-progress-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="cl-footer">
              <p style={{ fontSize: 13, color: "#475569", margin: 0, fontWeight: 500 }}>
                <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: "#2563eb" }} />
                {completedLessons.length} of {totalL} lessons completed ({pct}%)
              </p>
              <button className="primary" onClick={() => { openLesson(activeCourse.lessons[0]); goTo("Create course"); }}>
                Resume Learning <ChevronRight size={17} />
              </button>
            </div>

            {/* If there are additional saved courses, show them as quick cards */}
            {allCourses.length > 1 && (
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
                <p className="eyebrow" style={{ marginBottom: 12 }}>OTHER SAVED COURSES ({allCourses.length})</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {allCourses.map(c => (
                    <article key={c.id || c.title} style={{ padding: 14, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                      <b style={{ fontSize: 13, display: "block", color: "#0f172a", marginBottom: 4 }}>{c.title}</b>
                      <small style={{ color: "#64748b" }}>{c.lessons.length} lessons • {c.level}</small>
                      <button className="text-button" style={{ marginTop: 8, fontSize: 12 }} onClick={() => { setSavedCourse(c); openLesson(c.lessons[0]); goTo("Create course"); }}>
                        Open Course <ChevronRight size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* ── 4. Quick Assessment & Topic Mastery Section ── */}
      <section className="section-heading">
        <div><p className="eyebrow">KNOW YOUR PROGRESS</p><h2>Topic mastery & analytics</h2></div>
        <button className="text-button" onClick={() => goTo("Analytics")}>Open analytics <ChevronRight size={16}/></button>
      </section>
      <section className="analytics">
        <article className="chart-card empty-card">
          <Trophy size={27}/>
          <div>
            <h3>Assessment Performance</h3>
            <p>{quizHistory.length > 0 ? `You have completed ${quizHistory.length} quiz assessment(s). Keep practising to boost your accuracy!` : "Take your first course or topic quiz to unlock topic scores, weak-area detection, and progress charts."}</p>
          </div>
        </article>
        <article className="score-card">
          <p className="eyebrow">LATEST ASSESSMENT</p>
          <div className="score-ring">
            <b>{quizHistory.length > 0 ? `${Math.round((quizHistory[0].score / quizHistory[0].totalQuestions) * 100)}%` : "—"}</b>
          </div>
          <h3>{quizHistory.length > 0 ? quizHistory[0].title : "Nothing to review yet"}</h3>
          <p>{quizHistory.length > 0 ? `Score: ${quizHistory[0].score} / ${quizHistory[0].totalQuestions}` : "Your completed quiz results will appear here."}</p>
          <button className="text-button" onClick={() => goTo("Quizzes")}>
            {quizHistory.length > 0 ? "Take another quiz" : "Start a quiz"} <ChevronRight size={16}/>
          </button>
        </article>
      </section>
      </>}

      {/* ════════════════════════════════════════════════ */}
      {/* PAGE: Create Course                              */}
      {/* ════════════════════════════════════════════════ */}
      {activeNav === "Create course" && <>
      <header><div><p className="eyebrow">AI COURSE BUILDER</p><h1>Create a new course <span>✦</span></h1><p className="subtitle">Describe your learning goal and AsterLearn will build a personalised path.</p></div></header>
      {courseBuilderBlock}
      </>}

      {/* ════════════════════════════════════════════════ */}
      {/* PAGE: My Learning                                */}
      {/* ════════════════════════════════════════════════ */}
      {activeNav === "My learning" && <>
      <header><div><p className="eyebrow">YOUR LEARNING LIBRARY</p><h1>My Learning <span>✦</span></h1><p className="subtitle">Everything you've built, completed, and practised — stored securely in your account.</p></div></header>

      {!learningLoaded ? <div className="loading-state"><p>Loading your learning data...</p></div> : <>

      {/* ── All saved courses ── */}
      <section className="section-heading"><div><p className="eyebrow">SAVED COURSES</p><h2>Your courses ({allCourses.length})</h2></div><button className="text-button" onClick={() => goTo("Create course")}>Create new <ChevronRight size={16}/></button></section>

      {allCourses.length === 0
        ? <section className="empty-learning-card"><BookOpen size={28}/><div><h3>No courses yet</h3><p>Create your first AI-generated course to start building your learning library.</p></div><button className="primary" onClick={() => goTo("Create course")}>Create a course <ChevronRight size={17}/></button></section>
        : <section className="my-courses-grid">{allCourses.map(course => {
            const pct = course.totalLessons > 0 ? Math.round((course.completedCount / course.totalLessons) * 100) : 0;
            return <article className="my-course-card" key={course.id}>
              <div className="course-top"><span className="course-icon">▣</span><span className="pill">{course.level.toUpperCase()}</span></div>
              <h3>{course.title}</h3>
              <p className="course-goal">{course.goal}</p>
              <div className="progress-bar-wrapper"><div className="progress-bar" style={{ width: `${pct}%` }}/></div>
              <p className="progress-text"><CheckCircle2 size={14}/> {course.completedCount} / {course.totalLessons} lessons completed ({pct}%)</p>
              <div className="my-course-lessons">{course.lessons.map(lesson => <div className={`my-lesson-item ${completedLessons.includes(lesson.id) ? "completed" : ""}`} key={lesson.id}><span>{completedLessons.includes(lesson.id) ? "✓" : "○"}</span><span>{lesson.title}</span></div>)}</div>
              <button className="primary full" onClick={() => { setSavedCourse(course); openLesson(course.lessons[0]); goTo("Create course"); }}>Continue learning <ChevronRight size={17}/></button>
            </article>;
          })}</section>
      }

      {/* ── Quiz history ── */}
      <section className="section-heading" style={{marginTop: 40}}><div><p className="eyebrow">QUIZ HISTORY</p><h2>Your assessments ({quizHistory.length})</h2></div></section>

      {quizHistory.length === 0
        ? <section className="empty-learning-card"><Trophy size={28}/><div><h3>No quizzes taken yet</h3><p>Complete a lesson quiz or start a topic practice to see your history here.</p></div><button className="primary" onClick={() => goTo("Quizzes")}>Start practising <ChevronRight size={17}/></button></section>
        : <section className="quiz-history-grid">{quizHistory.map(item => {
            const pct = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
            return <article className="quiz-history-card" key={item.attemptId}>
              <div className="qh-top"><span className={`qh-badge ${item.sourceType === "lesson" ? "qh-lesson" : "qh-topic"}`}>{item.sourceType === "lesson" ? "LESSON QUIZ" : "TOPIC PRACTICE"}</span><span className={`qh-diff qh-${item.difficulty}`}>{item.difficulty.toUpperCase()}</span></div>
              <h3>{item.title}</h3>
              {item.topic && <p className="qh-topic-name">{item.topic}</p>}
              <div className="qh-score-row"><div className={`qh-score-ring ${pct >= 70 ? "qh-good" : pct >= 40 ? "qh-mid" : "qh-low"}`}><b>{pct}%</b></div><div><b>{item.score} / {item.totalQuestions}</b>{item.revealedAnswerCount > 0 && <small>{item.revealedAnswerCount} answer{item.revealedAnswerCount > 1 ? "s" : ""} revealed</small>}{item.completedAt && <small>{new Date(item.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small>}</div></div>
            </article>;
          })}</section>
      }
      </>}
      </>}

      {/* ════════════════════════════════════════════════ */}
      {/* PAGE: Quizzes                                    */}
      {/* ════════════════════════════════════════════════ */}
      {activeNav === "Quizzes" && <>
      <header><div><p className="eyebrow">PRACTICE & ASSESS</p><h1>Quizzes <span>✦</span></h1><p className="subtitle">Search any topic, pick your difficulty, and practise with AI-generated assessments.</p></div></header>

      <section className="topic-practice" ref={quizRef} id="topic-practice">
        <div><p className="eyebrow">TOPIC PRACTICE</p><h2>Practise any topic</h2><p>Search a topic to receive a fresh 10-question assessment. Viewing a solution makes that question worth 0 points.</p></div>
        <div className="topic-search"><input value={practiceTopic} onChange={event => setPracticeTopic(event.target.value)} onKeyDown={event => { if (event.key === "Enter") generateTopicQuiz(); }} placeholder="Search what you want to learn..." aria-label="Practice topic"/><button className="primary" onClick={generateTopicQuiz} disabled={practiceLoading}>{practiceLoading ? "Creating quiz..." : "Start practice"}</button></div>

        {/* ── NEW: Difficulty selector ── */}
        <div className="difficulty-selector">
          <p className="eyebrow">DIFFICULTY LEVEL</p>
          <div className="difficulty-buttons">
            <button className={`diff-btn diff-easy ${difficulty === "easy" ? "diff-active" : ""}`} onClick={() => setDifficulty("easy")}>🟢 Easy</button>
            <button className={`diff-btn diff-medium ${difficulty === "medium" ? "diff-active" : ""}`} onClick={() => setDifficulty("medium")}>🟡 Medium</button>
            <button className={`diff-btn diff-hard ${difficulty === "hard" ? "diff-active" : ""}`} onClick={() => setDifficulty("hard")}>🔴 Hard</button>
          </div>
        </div>

        {/* ── Practice quiz display ── */}
        {practiceQuiz && <section className="quiz-panel">
          <div className="quiz-header-top">
            <span className={`quiz-diff-badge diff-tag-${difficulty}`}>
              {difficulty === "easy" ? "🟢 EASY" : difficulty === "medium" ? "🟡 MEDIUM" : "🔴 HARD"}
            </span>
            <p className="eyebrow" style={{ margin: 0 }}>
              {practiceSeqMode ? `QUESTION ${practiceSeqIndex + 1} OF ${practiceQuiz.questions.length}` : "10-QUESTION ASSESSMENT"}
            </p>
          </div>
          <h3>{practiceQuiz.title}</h3>

          {/* Sequential mode: one question at a time */}
          {practiceSeqMode ? (() => {
            const index = practiceSeqIndex;
            const question = practiceQuiz.questions[index];
            if (!question) return null;
            const revealed = revealedAnswers.includes(index);
            return <>
              <article className="quiz-question" key={question.question}>
                <b>{index + 1}. {question.question}</b>
                {question.options.map(option => <label key={option} className={practiceAnswers[index] === option ? "selected-option" : ""}><input type="radio" name={`practice-question-${index}`} disabled={practiceStage !== "quiz"} checked={practiceAnswers[index] === option} onChange={() => setPracticeAnswers({ ...practiceAnswers, [index]: option })}/>{option}</label>)}
                {revealed ? <p className="solution"><b>Solution:</b> {question.correct_answer} — {question.explanation}<span>0 points for this question</span></p> : <button className="reveal-answer" onClick={() => setRevealedAnswers([...revealedAnswers, index])} disabled={practiceStage === "complete"}>View answer <small>−1 mark</small></button>}
              </article>
              <div className="seq-nav">
                {index > 0 && <button className="outline" onClick={() => setPracticeSeqIndex(index - 1)}><ChevronLeft size={17}/> Previous</button>}
                {index < practiceQuiz.questions.length - 1 && practiceAnswers[index] !== undefined
                  ? <button className="primary" onClick={() => setPracticeSeqIndex(index + 1)}>Next question <ChevronRight size={17}/></button>
                  : index === practiceQuiz.questions.length - 1 && practiceStage === "quiz"
                    ? <button className="primary" onClick={finishPractice}>Finish practice</button>
                    : null
                }
              </div>
            </>;
          })()

          /* Normal mode: all questions at once (preserved exactly) */
          : <>{practiceQuiz.questions.map((question, index) => { const revealed = revealedAnswers.includes(index); return <article className="quiz-question" key={question.question}><b>{index + 1}. {question.question}</b>{question.options.map(option => <label key={option} className={practiceAnswers[index] === option ? "selected-option" : ""}><input type="radio" name={`practice-question-${index}`} disabled={practiceStage !== "quiz"} checked={practiceAnswers[index] === option} onChange={() => setPracticeAnswers({ ...practiceAnswers, [index]: option })}/>{option}</label>)}{revealed ? <p className="solution"><b>Solution:</b> {question.correct_answer} — {question.explanation}<span>{practiceStage === "results" ? "Answer review — your final score is unchanged" : "0 points for this question"}</span></p> : <button className="reveal-answer" onClick={() => setRevealedAnswers([...revealedAnswers, index])} disabled={practiceStage === "complete"}>View answer <small>{practiceStage === "results" ? "review answer" : "−1 mark"}</small></button>}</article>; })}
            {practiceStage === "quiz" && <button className="primary" onClick={finishPractice}>Finish practice</button>}
          </>}

          {practiceStage === "complete" && <div className="practice-next"><b>Practice set complete</b><p>Would you like another 10 questions on {practiceTopic}, or view your result?</p><button className="outline" onClick={generateTopicQuiz} disabled={practiceLoading}>Practice more (all at once)</button><button className="outline" onClick={startSeqPractice} disabled={practiceLoading}>Next question mode <ChevronRight size={17}/></button><button className="primary" onClick={() => setPracticeStage("results")}>View results</button></div>}
          {practiceStage === "results" && <div className="quiz-result"><b>Result: {practiceScore} / {practiceQuiz.questions.length}</b><p>Your final score is saved. Use \u201cView answer\u201d under any question to review solutions.</p><button className="outline" onClick={generateTopicQuiz} disabled={practiceLoading}>Practice this topic again</button><button className="outline" onClick={startSeqPractice} disabled={practiceLoading}>Next question mode <ChevronRight size={17}/></button><button className="primary" onClick={generateTopicQuiz} disabled={practiceLoading}>{practiceLoading ? "Creating quiz..." : <>Next <ChevronRight size={17}/></>}</button></div>}
        </section>}
      </section>
      </>}

      {/* ════════════════════════════════════════════════ */}
      {/* PAGE: Analytics                                  */}
      {/* ════════════════════════════════════════════════ */}
      {activeNav === "Analytics" && <>
      <header><div><p className="eyebrow">KNOW YOUR PROGRESS</p><h1>Analytics <span>✦</span></h1><p className="subtitle">Track your quiz scores, identify weak areas, and measure your growth.</p></div></header>
      <section className="analytics"><article className="chart-card empty-card"><Trophy size={27}/><div><h3>No assessment data yet</h3><p>Take your first course quiz to unlock topic scores, weak-area detection, and progress charts.</p></div></article><article className="score-card"><p className="eyebrow">LATEST ASSESSMENT</p><div className="score-ring"><b>—</b></div><h3>Nothing to review yet</h3><p>Your first completed quiz will appear here.</p><button className="text-button" onClick={() => goTo("Quizzes")}>Start a quiz <ChevronRight size={16}/></button></article></section>
      </>}

    </main>

    {/* ════════════════════════════════════════════════ */}
    {/* AUTH MODAL                                       */}
    {/* ════════════════════════════════════════════════ */}
    {showAuthModal && (
      <div className="auth-modal-backdrop" onClick={() => setShowAuthModal(false)}>
        <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
          <button className="auth-modal-close" onClick={() => setShowAuthModal(false)} aria-label="Close modal">
            <X size={18} />
          </button>

          <div className="auth-header">
            <div className="auth-brand-icon">
              <BrainCircuit size={26} />
            </div>
            <h2>{authMode === "login" ? "Welcome back" : "Create an account"}</h2>
            <p>
              {authMode === "login"
                ? "Sign in to sync your courses, quizzes, and learning progress."
                : "Register your account to save your learning journey."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === "login" ? "active" : ""}`}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >
              Log In
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === "register" ? "active" : ""}`}
              onClick={() => { setAuthMode("register"); setAuthError(""); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="auth-form">
            {authMode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} />
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="John Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} />
                <input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="auth-error">
                <AlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={authSubmitting}>
              {authSubmitting ? (
                "Please wait..."
              ) : authMode === "login" ? (
                <>
                  <LogIn size={16} /> Sign In
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Create Account
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )}
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
