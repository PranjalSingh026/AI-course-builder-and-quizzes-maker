from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import CourseGenerateRequest, CoursePreview, QuizGenerateRequest, QuizOut, TopicQuizGenerateRequest
from app.services.course_generator import generate_course_preview, generate_lesson_quiz, generate_topic_quiz

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/v1/courses/generate", response_model=CoursePreview)
def generate_course(payload: CourseGenerateRequest):
    try:
        return generate_course_preview(payload.goal, payload.level, payload.lesson_count)
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Course generation is temporarily unavailable.") from error


@app.post("/api/v1/quizzes/generate", response_model=QuizOut)
def generate_quiz(payload: QuizGenerateRequest):
    try:
        return generate_lesson_quiz(payload.lesson_title, payload.lesson_summary, payload.objectives, payload.question_count, payload.difficulty)
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Quiz generation is temporarily unavailable.") from error


@app.post("/api/v1/quizzes/topic", response_model=QuizOut)
def generate_topic_practice_quiz(payload: TopicQuizGenerateRequest):
    try:
        return generate_topic_quiz(payload.topic, payload.question_count, payload.difficulty)
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Quiz generation is temporarily unavailable.") from error
