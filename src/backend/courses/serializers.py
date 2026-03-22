from rest_framework import serializers

from courses.models import Course, CourseEnrollment
from progress.utils import build_progress_payload


class CourseListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ("id", "title", "short_description")


class CourseDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "short_description",
            "content",
            "status",
            "created_at",
            "updated_at",
        )


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = ("id", "user", "course", "progress_status", "enrolled_at")
        read_only_fields = ("id", "user", "enrolled_at")


class MyCourseSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(source="course.title", read_only=True)
    short_description = serializers.CharField(source="course.short_description", read_only=True)
    progress_percent = serializers.SerializerMethodField()
    progress_status = serializers.SerializerMethodField()
    is_test_passed = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = (
            "course_id",
            "title",
            "short_description",
            "enrolled_at",
            "is_theory_completed",
            "progress_percent",
            "progress_status",
            "is_test_passed",
        )

    def _progress_payload(self, obj):
        if not hasattr(obj, "_my_course_progress_payload"):
            obj._my_course_progress_payload = build_progress_payload(enrollment=obj)
        return obj._my_course_progress_payload

    def get_progress_percent(self, obj):
        return self._progress_payload(obj)["progress_percent"]

    def get_progress_status(self, obj):
        return self._progress_payload(obj)["progress_status"]

    def get_is_test_passed(self, obj):
        return self._progress_payload(obj)["is_test_passed"]
