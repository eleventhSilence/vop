from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from courses.models import CourseEnrollment
from progress.utils import build_progress_payload, sync_enrollment_progress_status
from reviews.models import Review
from testing.models import TestAttempt


RECENT_DASHBOARD_ITEMS_LIMIT = 3


def _build_attempt_ids_map(*, user, enrollments: list[CourseEnrollment]) -> dict[UUID, list[UUID]]:
    course_ids = [enrollment.course_id for enrollment in enrollments]
    if not course_ids:
        return {}

    attempts = (
        TestAttempt.objects.filter(user=user, test__course_id__in=course_ids)
        .select_related("test", "test__course")
        .order_by("-created_at")
    )

    attempt_ids_map: dict[UUID, list[UUID]] = defaultdict(list)
    for attempt in attempts:
        attempt_ids_map[attempt.test.course_id].append(attempt.pk)

    return attempt_ids_map


def _get_attempts_queryset(*, course_id: UUID, attempt_ids_map: dict[UUID, list[UUID]]):
    attempt_ids = attempt_ids_map.get(course_id, [])
    if not attempt_ids:
        return TestAttempt.objects.none()

    return TestAttempt.objects.filter(pk__in=attempt_ids).order_by("-created_at")


def _get_user_enrollments(*, user) -> list[CourseEnrollment]:
    return list(
        CourseEnrollment.objects.filter(user=user)
        .select_related("course")
        .order_by("-enrolled_at")
    )


def build_account_dashboard(*, user) -> dict:
    enrollments = _get_user_enrollments(user=user)
    attempt_ids_map = _build_attempt_ids_map(user=user, enrollments=enrollments)

    for enrollment in enrollments:
        sync_enrollment_progress_status(
            enrollment=enrollment,
            attempts=_get_attempts_queryset(course_id=enrollment.course_id, attempt_ids_map=attempt_ids_map),
        )

    stats = {
        "enrolled_courses_count": len(enrollments),
        "completed_courses_count": sum(enrollment.progress_status == "completed" for enrollment in enrollments),
        "in_progress_courses_count": sum(enrollment.progress_status != "completed" for enrollment in enrollments),
    }

    recent_enrollments = enrollments[:RECENT_DASHBOARD_ITEMS_LIMIT]
    recent_course_progress_payloads = {
        enrollment.pk: build_progress_payload(
            enrollment=enrollment,
            attempts=_get_attempts_queryset(course_id=enrollment.course_id, attempt_ids_map=attempt_ids_map),
        )
        for enrollment in recent_enrollments
    }

    recent_reviews = list(
        Review.objects.filter(user=user)
        .select_related("course")
        .order_by("-created_at")[:RECENT_DASHBOARD_ITEMS_LIMIT]
    )

    return {
        "user": user,
        "stats": stats,
        "recent_courses": recent_enrollments,
        "recent_reviews": recent_reviews,
        "recent_course_progress_payloads": recent_course_progress_payloads,
    }
