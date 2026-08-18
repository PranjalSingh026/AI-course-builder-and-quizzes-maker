from typing import Literal
from pydantic import BaseModel, Field


class CourseGenerateRequest(BaseModel):
    goal: str = Field(min_length=8, max_length=600)
    level: str = "Beginner"
    lesson_count: int = Field(default=4, ge=3, le=6)


class LessonOut(BaseModel):
    title: str
    summary: str
    objectives: list[str]


class CoursePreview(BaseModel):
    title: str
    description: str
    level: str
    lessons: list[LessonOut]


class QuizGenerateRequest(BaseModel):
    lesson_title: str = Field(min_length=3, max_length=300)
    lesson_summary: str = Field(min_length=3, max_length=1000)
    objectives: list[str] = Field(min_length=1, max_length=8)
    question_count: int = Field(default=5, ge=3, le=10)
    difficulty: Literal['easy', 'medium', 'hard'] = Field(default='medium')


class TopicQuizGenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    question_count: int = Field(default=10, ge=10, le=10)
    difficulty: Literal['easy', 'medium', 'hard'] = Field(default='medium')


class QuizQuestionOut(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer: str
    explanation: str


class QuizOut(BaseModel):
    title: str
    questions: list[QuizQuestionOut]
