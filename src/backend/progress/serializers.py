from rest_framework import serializers

from courses.models import CourseEnrollment
from progress.utils import build_progress_payload
from testing.models import TestAttempt


class ProgressAttemptSerializer(serializers.ModelSerializer):
    attempt_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = TestAttempt
        fields = ("attempt_id", "score", "is_passed", "attempt_number", "created_at")


class CompleteTheorySerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(read_only=True)
    progress_percent = serializers.SerializerMethodField()
    progress_status = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = (
            "course_id",
            "is_theory_completed",
            "theory_completed_at",
            "progress_percent",
            "progress_status",
        )

    def _progress_payload(self, obj):
        if not hasattr(obj, "_complete_theory_progress_payload"):
            obj._complete_theory_progress_payload = build_progress_payload(enrollment=obj)
        return obj._complete_theory_progress_payload

    def get_progress_percent(self, obj):
        return self._progress_payload(obj)["progress_percent"]

    def get_progress_status(self, obj):
        return self._progress_payload(obj)["progress_status"]


class CourseProgressSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    progress_percent = serializers.SerializerMethodField()
    progress_status = serializers.SerializerMethodField()
    total_attempts = serializers.SerializerMethodField()
    best_score = serializers.SerializerMethodField()
    is_test_passed = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = (
            "course_id",
            "course_title",
            "progress_percent",
            "progress_status",
            "is_theory_completed",
            "total_attempts",
            "best_score",
            "is_test_passed",
        )

    def _progress_payload(self, obj):
        if not hasattr(obj, "_progress_payload"):
            obj._progress_payload = build_progress_payload(enrollment=obj)
        return obj._progress_payload

    def get_progress_percent(self, obj):
        return self._progress_payload(obj)["progress_percent"]

    def get_progress_status(self, obj):
        return self._progress_payload(obj)["progress_status"]

    def get_total_attempts(self, obj):
        return self._progress_payload(obj)["total_attempts"]

    def get_best_score(self, obj):
        return self._progress_payload(obj)["best_score"]

    def get_is_test_passed(self, obj):
        return self._progress_payload(obj)["is_test_passed"]


class CourseProgressDetailSerializer(CourseProgressSerializer):
    theory_completed_at = serializers.DateTimeField(read_only=True)
    attempts = serializers.SerializerMethodField()

    class Meta(CourseProgressSerializer.Meta):
        fields = (
            "course_id",
            "course_title",
            "progress_percent",
            "progress_status",
            "is_theory_completed",
            "theory_completed_at",
            "total_attempts",
            "best_score",
            "is_test_passed",
            "attempts",
        )

    def get_attempts(self, obj):
        payload = self._progress_payload(obj)
        return ProgressAttemptSerializer(payload["attempts"], many=True).data
