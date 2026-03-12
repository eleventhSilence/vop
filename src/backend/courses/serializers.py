from rest_framework import serializers

from courses.models import Course, CourseEnrollment


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
