import json

from google import genai

from app.config import settings
from app.schemas import CoursePreview, LessonOut, QuizOut


COURSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "level": {"type": "string"},
        "lessons": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "objectives": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "summary", "objectives"],
            },
        },
    },
    "required": ["title", "description", "level", "lessons"],
}

QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                    "correct_answer": {"type": "string"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "options", "correct_answer", "explanation"],
            },
        },
    },
    "required": ["title", "questions"],
}


def _local_preview(goal: str, level: str, lesson_count: int) -> CoursePreview:
    """Offline development fallback when no API key has been configured."""
    subject = goal.replace("I want to learn", "").replace("I want to", "").strip(" .")
    steps = [
        ("Foundations", "Build the essential vocabulary and mental models."),
        ("Core concepts", "Learn the concepts that appear most often in practice."),
        ("Applied practice", "Use worked examples and solve realistic problems."),
        ("Assessment readiness", "Review, identify gaps, and prepare for an adaptive quiz."),
        ("Advanced applications", "Connect the concepts to higher-level scenarios."),
        ("Final revision", "Consolidate knowledge through a mixed assessment."),
    ][:lesson_count]
    lessons = [
        LessonOut(
            title=f"{index + 1}. {name}: {subject}",
            summary=summary,
            objectives=[f"Explain the {name.lower()} of {subject}", "Apply the concept to a short problem"],
        )
        for index, (name, summary) in enumerate(steps)
    ]
    return CoursePreview(
        title=f"{subject.title()} Learning Path",
        description=f"A {level.lower()}-friendly, AI-generated path designed around your goal: {goal}",
        level=level,
        lessons=lessons,
    )


def generate_course_preview(goal: str, level: str, lesson_count: int) -> CoursePreview:
    """Return a validated course plan from Gemini, or local preview during setup."""
    if not settings.gemini_api_key:
        return _local_preview(goal, level, lesson_count)

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.interactions.create(
        model=settings.gemini_model,
        input=(
            "You are an expert instructional designer for a placement-preparation platform. "
            "Create a practical progression with concise, factual lesson summaries. "
            f"Create exactly {lesson_count} lessons for this learner goal: {goal}. "
            f"Learner level: {level}. Each lesson must have two specific objectives."
        ),
        response_format={"type": "text", "mime_type": "application/json", "schema": COURSE_SCHEMA},
    )
    return CoursePreview.model_validate(json.loads(response.output_text))


def generate_lesson_quiz(lesson_title: str, lesson_summary: str, objectives: list[str], question_count: int, difficulty: str) -> QuizOut:
    if not settings.gemini_api_key:
        raise ValueError("Gemini API key is not configured")
    diff_text = "simpler, more straightforward questions" if difficulty == "easy" else "tricky, requires deeper understanding" if difficulty == "hard" else "standard difficulty"
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.interactions.create(
        model=settings.gemini_model,
        input=(
            "Create an accurate multiple-choice assessment for this lesson. "
            f"Lesson: {lesson_title}. Summary: {lesson_summary}. Objectives: {', '.join(objectives)}. "
            f"Create exactly {question_count} {difficulty}-level questions ({diff_text}). Each must have exactly four plausible options. "
            "The correct answer must exactly equal one of the four options. Give a short explanation."
        ),
        response_format={"type": "text", "mime_type": "application/json", "schema": QUIZ_SCHEMA},
    )
    return QuizOut.model_validate(json.loads(response.output_text))


def generate_topic_quiz(topic: str, question_count: int, difficulty: str) -> QuizOut:
    """Create a standalone practice quiz for a learner's searched topic."""
    if not settings.gemini_api_key:
        raise ValueError("Gemini API key is not configured")
    diff_text = "simpler, more straightforward questions" if difficulty == "easy" else "tricky, requires deeper understanding" if difficulty == "hard" else "standard difficulty"
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.interactions.create(
        model=settings.gemini_model,
        input=(
            "Create an accurate, self-contained multiple-choice practice assessment. "
            f"Topic searched by the learner: {topic}. "
            f"Create exactly {question_count} {difficulty}-level questions covering useful, varied parts of this topic ({diff_text}). "
            "Each must have exactly four plausible options. The correct answer must exactly equal "
            "one option. Give a short, clear explanation suitable for a student."
        ),
        response_format={"type": "text", "mime_type": "application/json", "schema": QUIZ_SCHEMA},
    )
    return QuizOut.model_validate(json.loads(response.output_text))
