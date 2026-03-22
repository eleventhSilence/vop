from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from django.db.models import Count, Q

from accounts.models import Account, AccountRole, AccountStatus
from courses.models import Course, CourseEnrollment, CourseStatus
from progress.utils import build_progress_payload
from reviews.models import Review, ReviewStatus
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion


RECENT_DASHBOARD_ITEMS_LIMIT = 3
ADMIN_DASHBOARD_ITEMS_LIMIT = 5


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
    progress_payloads = {
        enrollment.pk: build_progress_payload(
            enrollment=enrollment,
            attempts=_get_attempts_queryset(course_id=enrollment.course_id, attempt_ids_map=attempt_ids_map),
        )
        for enrollment in enrollments
    }

    stats = {
        "enrolled_courses_count": len(enrollments),
        "completed_courses_count": sum(
            payload["progress_status"] == "completed" for payload in progress_payloads.values()
        ),
        "in_progress_courses_count": sum(
            payload["progress_status"] != "completed" for payload in progress_payloads.values()
        ),
    }

    recent_enrollments = enrollments[:RECENT_DASHBOARD_ITEMS_LIMIT]
    recent_course_progress_payloads = {
        enrollment.pk: progress_payloads[enrollment.pk]
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


def build_admin_dashboard() -> dict:
    user_summary = Account.objects.aggregate(
        total_users=Count("id"),
        active_users_count=Count("id", filter=Q(status=AccountStatus.ACTIVE)),
        blocked_users_count=Count("id", filter=Q(status=AccountStatus.BLOCKED)),
        admins_count=Count("id", filter=Q(role=AccountRole.ADMIN)),
        regular_users_count=Count("id", filter=Q(role=AccountRole.USER)),
    )
    course_summary = Course.objects.aggregate(
        total_courses=Count("id"),
        available_courses_count=Count("id", filter=Q(status=CourseStatus.AVAILABLE)),
        unavailable_courses_count=Count("id", filter=Q(status=CourseStatus.UNAVAILABLE)),
    )
    review_summary = Review.objects.aggregate(
        total_reviews=Count("id"),
        pending_reviews_count=Count("id", filter=Q(status=ReviewStatus.PENDING)),
        approved_reviews_count=Count("id", filter=Q(status=ReviewStatus.APPROVED)),
        rejected_reviews_count=Count("id", filter=Q(status=ReviewStatus.REJECTED)),
    )
    testing_summary = {
        "total_tests": CourseTest.objects.count(),
        "total_questions": TestQuestion.objects.count(),
        "total_answer_options": AnswerOption.objects.count(),
    }
    recent_users = list(
        Account.objects.order_by("-registered_at", "email")[:ADMIN_DASHBOARD_ITEMS_LIMIT]
    )
    pending_reviews = list(
        Review.objects.filter(status=ReviewStatus.PENDING)
        .select_related("user", "course")
        .order_by("-created_at")[:ADMIN_DASHBOARD_ITEMS_LIMIT]
    )

    return {
        "users": user_summary,
        "courses": course_summary,
        "reviews": review_summary,
        "testing": testing_summary,
        "recent_users": recent_users,
        "pending_reviews": pending_reviews,
    }
