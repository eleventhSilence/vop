from __future__ import annotations

from django.db.models import Max, QuerySet

from courses.models import CourseEnrollment
from testing.models import TestAttempt


PROGRESS_STATUS_NOT_ENROLLED = "not_enrolled"
PROGRESS_STATUS_ENROLLED = "enrolled"
PROGRESS_STATUS_THEORY_COMPLETED = "theory_completed"
PROGRESS_STATUS_TESTING_IN_PROGRESS = "testing_in_progress"
PROGRESS_STATUS_COMPLETED = "completed"

PROGRESS_STATUS_TO_PERCENT = {
    PROGRESS_STATUS_ENROLLED: 25,
    PROGRESS_STATUS_THEORY_COMPLETED: 50,
    PROGRESS_STATUS_TESTING_IN_PROGRESS: 75,
    PROGRESS_STATUS_COMPLETED: 100,
}


def get_course_attempts(*, enrollment: CourseEnrollment) -> QuerySet[TestAttempt]:
    return TestAttempt.objects.filter(
        user=enrollment.user,
        test__course=enrollment.course,
    ).order_by("-created_at")


def calculate_progress_status(
    *, enrollment: CourseEnrollment, attempts: QuerySet[TestAttempt] | None = None
) -> str:
    if attempts is None:
        attempts = get_course_attempts(enrollment=enrollment)

    total_attempts = attempts.count()
    is_test_passed = attempts.filter(is_passed=True).exists()

    if not enrollment.is_theory_completed:
        return PROGRESS_STATUS_ENROLLED
    if total_attempts == 0:
        return PROGRESS_STATUS_THEORY_COMPLETED
    if is_test_passed:
        return PROGRESS_STATUS_COMPLETED
    return PROGRESS_STATUS_TESTING_IN_PROGRESS


def sync_enrollment_progress_status(
    *, enrollment: CourseEnrollment, attempts: QuerySet[TestAttempt] | None = None, save: bool = True
) -> str:
    progress_status = calculate_progress_status(enrollment=enrollment, attempts=attempts)

    if enrollment.progress_status != progress_status:
        enrollment.progress_status = progress_status
        if save and enrollment.pk:
            enrollment.save(update_fields=("progress_status",))

    return progress_status


def build_progress_payload(*, enrollment: CourseEnrollment, attempts: QuerySet[TestAttempt] | None = None) -> dict:
    if attempts is None:
        attempts = get_course_attempts(enrollment=enrollment)

    attempts_summary = attempts.aggregate(best_score=Max("score"))
    total_attempts = attempts.count()
    is_test_passed = attempts.filter(is_passed=True).exists()
    progress_status = sync_enrollment_progress_status(enrollment=enrollment, attempts=attempts)
    progress_percent = PROGRESS_STATUS_TO_PERCENT[progress_status]

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
