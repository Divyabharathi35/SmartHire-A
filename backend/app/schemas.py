# ============================================================
#  schemas.py — Pydantic request / response models
# ============================================================
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRole(str, Enum):
    candidate = "candidate"
    recruiter  = "recruiter"
    admin      = "admin"


class AuthProvider(str, Enum):
    local  = "local"
    google = "google"
    github = "github"


# ── Request schemas ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.candidate

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[@$!%*?&]", v):
            raise ValueError("Password must contain a special character (@$!%*?&)")
        return v

    @field_validator("role")
    @classmethod
    def no_admin_self_register(cls, v: UserRole) -> UserRole:
        # Prevent self-registration as admin
        if v == UserRole.admin:
            return UserRole.candidate
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[@$!%*?&]", v):
            raise ValueError("Password must contain a special character (@$!%*?&)")
        return v


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name:     Optional[str]      = None
    email:    Optional[EmailStr] = None
    password: Optional[str]      = None
    role:     Optional[UserRole] = None  # Only admin can change


# ── Response schemas ─────────────────────────────────────────

class UserResponse(BaseModel):
    id:            UUID
    name:          str
    email:         str
    role:          UserRole
    auth_provider: AuthProvider
    avatar_url:    Optional[str] = None
    is_active:     bool
    last_login_at: Optional[datetime] = None
    created_at:    datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: UserResponse


class MessageResponse(BaseModel):
    success: bool
    message: str


# ── Interview Module Schemas ─────────────────────────────────

class InterviewType(str, Enum):
    hr = "HR Interview"
    technical = "Technical Interview"
    behavioral = "Behavioral Interview"
    aptitude = "Aptitude Interview"


class DifficultyLevel(str, Enum):
    easy = "Easy"
    medium = "Medium"
    hard = "Hard"
    expert = "Expert"


class GenerateQuestionsRequest(BaseModel):
    job_role: str
    domain: str = "Software Development"
    interview_type: str = "Technical Interview"
    difficulty: str = "Medium"
    experience_level: Optional[str] = "Mid Level"
    num_questions: int = 5
    user_skills: Optional[str] = None
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    generation_seed: Optional[str] = None



class CreateSessionRequest(BaseModel):
    job_role: str
    domain: str = "Software Development"
    interview_type: str = "Technical Interview"
    difficulty: str = "Medium"
    experience_level: Optional[str] = "Mid Level"
    num_questions: int = 5
    user_skills: Optional[str] = None
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    candidate_id: Optional[UUID] = None
    questions: Optional[list[dict]] = None
    is_mock: bool = False


# ── Mock Interview Dedicated Schemas ─────────────────────────────

class CreateMockSessionRequest(BaseModel):
    job_role: str = "Software Developer"
    domain: str = "Software Development"
    interview_type: str = "Technical Interview"
    difficulty: str = "Medium"
    experience_level: Optional[str] = "Mid Level"
    num_questions: int = 5
    user_skills: Optional[str] = None


class MockQuestionResponse(BaseModel):
    id: UUID
    session_id: UUID
    question_number: int
    question_text: str
    interview_type: str
    domain: str
    difficulty: str
    user_answer: Optional[str] = None

    model_config = {"from_attributes": True}


class MockSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    job_role: str
    domain: str
    interview_type: str
    difficulty: str
    experience_level: Optional[str] = None
    num_questions: int
    total_questions: int
    completed_questions: int
    current_question_index: int = 0
    status: str
    is_mock: bool = True
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    questions: Optional[list[MockQuestionResponse]] = None

    model_config = {"from_attributes": True}


class MockSessionHistoryResponse(BaseModel):
    id: UUID
    job_role: str
    domain: str
    interview_type: str
    difficulty: str
    num_questions: int
    completed_questions: int
    status: str
    is_mock: bool = True
    duration: Optional[int] = 0
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CandidateUserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    avatar_url: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    question_id: UUID
    user_answer: str
    started_at: Optional[datetime] = None
    answered_at: Optional[datetime] = None


class UpdateSessionRequest(BaseModel):
    status: Optional[str] = None
    score: Optional[float] = None
    current_question_index: Optional[int] = None


class PauseSessionRequest(BaseModel):
    current_question_index: Optional[int] = 0


class RecordingResponse(BaseModel):
    id: UUID
    session_id: UUID
    candidate_id: Optional[UUID] = None
    interview_id: Optional[UUID] = None
    recording_type: str = "video_audio"
    mime_type: str = "video/webm"
    file_size: int = 0
    duration: Optional[int] = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmitTimingRequest(BaseModel):
    question_id: Optional[UUID] = None
    question_number: int
    started_at: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    time_spent: int = 0


class QuestionTimingResponse(BaseModel):
    id: UUID
    session_id: UUID
    question_id: Optional[UUID] = None
    question_number: int
    started_at: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    time_spent: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionResponse(BaseModel):
    id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    question_number: int
    question_text: str
    interview_type: str
    domain: str
    difficulty: str
    expected_answer_points: list[str] = []
    category: Optional[str] = None
    user_answer: Optional[str] = None
    sample_answer: Optional[str] = None
    feedback: Optional[str] = None
    score: Optional[float] = None
    time_spent: Optional[int] = 0

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    created_by: Optional[UUID] = None
    candidate_id: Optional[UUID] = None
    job_role: str
    domain: str
    interview_type: str
    difficulty: str
    experience_level: Optional[str] = None
    num_questions: int
    user_skills: Optional[str] = None
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    status: str
    score: Optional[float] = None
    total_questions: int
    completed_questions: int
    current_question_index: Optional[int] = 0
    is_mock: bool = False
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    has_recording: Optional[bool] = False
    recording_id: Optional[UUID] = None
    questions: Optional[list[QuestionResponse]] = None
    timings: Optional[list[QuestionTimingResponse]] = None
    result: Optional["InterviewResultResponse"] = None
    question_results: Optional[list["QuestionResultResponse"]] = None

    model_config = {"from_attributes": True}


class InterviewResultResponse(BaseModel):
    id: UUID
    session_id: UUID
    candidate_id: Optional[UUID] = None
    interview_id: Optional[UUID] = None
    total_questions: int
    questions_completed: int
    completion_percentage: float
    total_duration: int
    average_question_time: float
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    behavioral_score: Optional[float] = None
    technical_relevance_score: Optional[float] = None
    confidence_score: Optional[float] = None
    professionalism_score: Optional[float] = None
    aptitude_score: Optional[float] = None
    problem_solving_score: Optional[float] = None
    culture_fit_score: Optional[float] = None
    motivation_score: Optional[float] = None
    leadership_score: Optional[float] = None
    adaptability_score: Optional[float] = None
    logical_reasoning_score: Optional[float] = None
    quantitative_score: Optional[float] = None
    overall_score: float
    performance_rating: Optional[str] = None
    recommendation: Optional[str] = None
    strengths: Optional[Any] = None
    weaknesses: Optional[Any] = None
    improvement_suggestions: Optional[Any] = None
    practice_recommendations: Optional[Any] = None
    learning_resources: Optional[Any] = None
    feedback_status: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    feedback_generated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QuestionResultResponse(BaseModel):
    id: UUID
    session_id: UUID
    result_id: Optional[UUID] = None
    question_id: Optional[UUID] = None
    question_number: int
    question_text: str
    answer_status: str
    time_spent: int
    answer_type: Optional[str] = None
    user_answer: Optional[str] = None
    score: Optional[float] = None
    evaluation: Optional[str] = None

    model_config = {"from_attributes": True}


class RecruiterAnalyticsResponse(BaseModel):
    total_interviews: int
    completed_interviews: int
    in_progress_interviews: int
    pending_interviews: int
    average_score: float
    average_duration: int
    performance_trends: Optional[List[Dict[str, Any]]] = None
    skill_analytics: Optional[List[Dict[str, Any]]] = None
    shortlisting_insights: Optional[Dict[str, Any]] = None
    shortlisted_candidates: Optional[List[Dict[str, Any]]] = None


class RecruiterCandidateInterviewResponse(BaseModel):
    id: UUID
    session_id: UUID
    candidate_id: Optional[UUID] = None
    candidate_name: str
    candidate_email: str
    job_role: str
    domain: str
    interview_type: str
    difficulty: str
    experience_level: Optional[str] = None
    status: str
    total_questions: int
    completed_questions: int
    completion_percentage: float
    duration: int
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AudioAnswerResponse(BaseModel):
    id: UUID
    session_id: UUID
    candidate_id: Optional[UUID] = None
    question_id: UUID
    question_number: int
    storage_location: str
    mime_type: str
    file_size: int
    duration: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Speech, Communication & Behavior Module Schemas ─────────────────────

class SubmitTranscriptRequest(BaseModel):
    question_id: UUID
    question_number: int
    transcript: str
    duration: int = 0
    word_count: int = 0


class TranscriptResponse(BaseModel):
    id: UUID
    session_id: UUID
    question_id: UUID
    candidate_id: Optional[UUID] = None
    question_number: int
    transcript: str
    duration: int
    word_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmitCommunicationAnalysisRequest(BaseModel):
    question_id: UUID
    question_number: int
    transcript: str
    duration: int = 0
    confidence_score: Optional[float] = None


class SpeechPaceDetails(BaseModel):
    words_per_minute: Optional[float] = None
    duration_minutes: Optional[float] = None
    total_words: int = 0
    pace_category: str = "Insufficient Data"
    status: str = "Insufficient Data"  # "Calculated" or "Insufficient Data"


class FillerWordsDetails(BaseModel):
    count: int = 0
    percentage: float = 0.0
    detected_words: list[str] = []


class GrammarDetails(BaseModel):
    score: Optional[float] = None
    error_count: int = 0
    feedback: str = "Insufficient Data"
    status: str = "Evaluated"  # "Evaluated" or "Insufficient Data"


class OverallCommunicationQualityDetails(BaseModel):
    score: Optional[float] = None
    confidence_level: str = "Low"
    summary: str = "Insufficient Data"


class CommunicationAnalysisResponse(BaseModel):
    id: UUID
    session_id: UUID
    question_id: UUID
    candidate_id: Optional[UUID] = None
    transcript_id: Optional[UUID] = None
    grammar_score: Optional[float] = None
    grammar_error_count: int = 0
    grammar_feedback: str = "Insufficient Data"
    filler_word_count: int = 0
    filler_words_per_minute: float = 0.0
    filler_rate: float = 0.0
    filler_words_list: list[str] = []
    words_per_minute: Optional[float] = None
    speaking_duration: int = 0
    word_count: int = 0
    pace_category: str = "Insufficient Data"
    pronunciation_score: Optional[float] = None
    pronunciation_status: str = "Insufficient Data"
    pronunciation_feedback: str = "Insufficient Data"
    communication_score: Optional[float] = None
    feedback: str = "Insufficient Data"
    strengths: list[str] = []
    weaknesses: list[str] = []
    speech_pace: Optional[SpeechPaceDetails] = None
    filler_words: Optional[FillerWordsDetails] = None
    grammar: Optional[GrammarDetails] = None
    overall_communication_quality: Optional[OverallCommunicationQualityDetails] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmitBehaviorAnalysisRequest(BaseModel):
    eye_contact_percentage: float = 75.0
    looking_away_duration: int = 0
    attention_breaks: int = 0
    eye_contact_status: str = "Available"
    observed_emotion: Optional[str] = "Neutral / Engaged"
    confidence_indicator: Optional[str] = "Moderate Observed Confidence"
    engagement_score: float = 80.0
    engagement_summary: Optional[str] = ""
    behavior_events: list[dict] = []


class BehaviorAnalysisResponse(BaseModel):
    id: UUID
    session_id: UUID
    candidate_id: Optional[UUID] = None
    eye_contact_percentage: float
    looking_away_duration: int
    attention_breaks: int
    eye_contact_status: str
    observed_emotion: str
    confidence_indicator: str
    engagement_score: float
    engagement_summary: str
    behavior_score: float
    behavior_events: list[dict] = []
    feedback: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Proctoring & Interview Integrity Schemas ─────────────────────────

class IntegrityEventCreate(BaseModel):
    event_type: str
    severity: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    message: str
    timestamp: Optional[datetime] = None
    duration: int = 0
    metadata: dict = {}


class BatchIntegrityEventsRequest(BaseModel):
    events: list[IntegrityEventCreate]


class IntegrityEventResponse(BaseModel):
    id: UUID
    session_id: UUID
    event_type: str
    severity: str
    message: str
    timestamp: datetime
    duration: int
    metadata: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmitProctoringSummaryRequest(BaseModel):
    face_verification_status: str = "PASSED"
    face_presence_percentage: float = 100.0
    multiple_face_count: int = 0
    looking_away_count: int = 0
    looking_away_duration: int = 0
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0
    screen_share_stop_count: int = 0
    possible_phone_count: int = 0
    camera_disconnect_count: int = 0
    mic_disconnect_count: int = 0
    suspicious_event_count: int = 0
    integrity_score: Optional[float] = None


class ProctoringSummaryResponse(BaseModel):
    id: UUID
    session_id: UUID
    face_verification_status: str
    face_presence_percentage: float
    multiple_face_count: int
    looking_away_count: int
    looking_away_duration: int
    tab_switch_count: int
    fullscreen_exit_count: int
    screen_share_stop_count: int
    possible_phone_count: int
    camera_disconnect_count: int
    mic_disconnect_count: int
    suspicious_event_count: int
    integrity_score: float
    final_status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StructuredAIEvaluation(BaseModel):
    """
    Pydantic schema enforcing structured AI evaluation output.
    All score fields are validated to be within 0..100.
    """
    technical_accuracy: float = Field(..., ge=0.0, le=100.0, description="Technical accuracy score (0-100)")
    keyword_relevance: float = Field(..., ge=0.0, le=100.0, description="Keyword relevance score (0-100)")
    problem_solving: float = Field(..., ge=0.0, le=100.0, description="Problem-solving ability score (0-100)")
    domain_knowledge: float = Field(..., ge=0.0, le=100.0, description="Domain knowledge score (0-100)")
    answer_completeness: float = Field(..., ge=0.0, le=100.0, description="Answer completeness score (0-100)")
    communication: float = Field(..., ge=0.0, le=100.0, description="Communication clarity score (0-100)")
    confidence_indicators: float = Field(..., ge=0.0, le=100.0, description="Observed confidence indicators score (0-100)")
    professionalism: float = Field(..., ge=0.0, le=100.0, description="Response professionalism score (0-100)")
    
    strengths: List[str] = Field(default_factory=list, description="Observed candidate strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Observed candidate weaknesses")
    improvement_suggestions: List[str] = Field(default_factory=list, description="Actionable improvement suggestions")
    practice_recommendations: List[str] = Field(default_factory=list, description="Targeted practice recommendations")
    learning_resources: List[str] = Field(default_factory=list, description="Relevant learning resources")

    @field_validator(
        "technical_accuracy", "keyword_relevance", "problem_solving",
        "domain_knowledge", "answer_completeness", "communication",
        "confidence_indicators", "professionalism",
        mode="before"
    )
    def validate_score_range(cls, v):
        if v is None:
            return 0.0
        try:
            val = float(v)
            return max(0.0, min(100.0, val))
        except (ValueError, TypeError):
            raise ValueError(f"Score must be a valid number between 0 and 100, got: {v}")

    @field_validator("strengths", "weaknesses", "improvement_suggestions", "practice_recommendations", "learning_resources", mode="before")
    def validate_string_list(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [v]
        return []


class CandidateComparisonDetail(BaseModel):
    session_id: UUID
    candidate_id: Optional[UUID] = None
    name: str
    role: str
    overall_score: Optional[float] = None
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    confidence_score: Optional[float] = None
    professionalism_score: Optional[float] = None
    status: str
    recommendation: Optional[str] = None
    initials: Optional[str] = None


class ComparisonDifference(BaseModel):
    technical_difference: Optional[float] = None
    confidence_difference: Optional[float] = None
    communication_difference: Optional[float] = None
    professionalism_difference: Optional[float] = None
    overall_difference: Optional[float] = None


class CandidateComparisonResponse(BaseModel):
    candidate_a: Optional[CandidateComparisonDetail] = None
    candidate_b: Optional[CandidateComparisonDetail] = None
    comparison: Optional[ComparisonDifference] = None
    radar_data: List[Dict[str, Any]] = []
    status: str = "available"

