from __future__ import annotations

from django.db.models import Max, QuerySet

from courses.models import CourseEnrollment
from testing.models import TestAttempt


PROGRESS_STATUS_NOT_ENROLLED = "not_enrolled"
PROGRESS_STATUS_ENROLLED = "enrolled"
PROGRESS_STATUS_THEORY_COMPLETED = "theory_completed"
PROGRESS_STATUS_TESTING_IN_PROGRESS = "testing_in_progress"
PROGRESS_STATUS_COMPLETED = "completed"


def get_course_attempts(*, enrollment: CourseEnrollment) -> QuerySet[TestAttempt]:
    return TestAttempt.objects.filter(
        user=enrollment.user,
        test__course=enrollment.course,
    ).order_by("-created_at")


def build_progress_payload(*, enrollment: CourseEnrollment, attempts: QuerySet[TestAttempt] | None = None) -> dict:
    if attempts is None:
        attempts = get_course_attempts(enrollment=enrollment)

    attempts_summary = attempts.aggregate(best_score=Max("score"))
    total_attempts = attempts.count()
    is_test_passed = attempts.filter(is_passed=True).exists()

    if not enrollment.is_theory_completed:
        progress_percent = 25
        progress_status = PROGRESS_STATUS_ENROLLED
    elif total_attempts == 0:
        progress_percent = 50
        progress_status = PROGRESS_STATUS_THEORY_COMPLETED
    elif is_test_passed:
        progress_percent = 100
        progress_status = PROGRESS_STATUS_COMPLETED
    else:
        progress_percent = 75
        progress_status = PROGRESS_STATUS_TESTING_IN_PROGRESS

    return {
        "course_id": enrollment.course_id,
        "course_title": enrollment.course.title,
        "is_theory_completed": enrollment.is_theory_completed,
        "theory_completed_at": enrollment.theory_completed_at,
        "progress_percent": progress_percent,
        "progress_status": progress_status,
        "total_attempts": total_attempts,
        "best_score": attempts_summary["best_score"],
        "is_test_passed": is_test_passed,
        "attempts": attempts,
    }
