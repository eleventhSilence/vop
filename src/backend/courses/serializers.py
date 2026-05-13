from rest_framework import serializers

from courses.models import Course, CourseEnrollment, CourseMedia
from progress.utils import build_progress_payload


class CourseListSerializer(serializers.ModelSerializer):
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ("course_id", "title", "short_description", "is_enrolled")

    course_id = serializers.UUIDField(source="id", read_only=True)

    def get_is_enrolled(self, obj):
        return bool(getattr(obj, "is_enrolled", False))


class CourseMediaSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    file_url = serializers.SerializerMethodField()
    markdown_image_snippet = serializers.SerializerMethodField()
    markdown_embed_snippet = serializers.SerializerMethodField()

    class Meta:
        model = CourseMedia
        fields = ("id", "course_id", "title", "slug", "media_type", "original_name", "file_size", "file_url", "markdown_image_snippet", "markdown_embed_snippet", "uploaded_at")

    def get_file_url(self, obj):
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_markdown_image_snippet(self, obj):
        if obj.media_type == "image":
            return f"![{obj.title}](media:{obj.slug})"
        return None

    def get_markdown_embed_snippet(self, obj):
        return f"{{{{ media:{obj.slug} }}}}"


class CourseDetailSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(source="id", read_only=True)
    media = CourseMediaSerializer(many=True, read_only=True)
    participants_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "course_id",
            "title",
            "short_description",
            "content",
            "status",
            "created_at",
            "updated_at",
            "media",
            "participants_count",
        )


class AdminCourseBaseSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(source="id", read_only=True)
    description = serializers.CharField(source="content")
    media = CourseMediaSerializer(many=True, read_only=True)
    status = serializers.ChoiceField(
        choices=Course._meta.get_field("status").choices,
        help_text="Use status to manage course availability in admin API. Physical deletion is not supported.",
    )

    class Meta:
        model = Course
        fields = (
            "course_id",
            "title",
            "short_description",
            "description",
            "status",
            "created_at",
            "updated_at",
            "media",
        )
        read_only_fields = ("course_id", "created_at", "updated_at", "media")


class AdminCourseListSerializer(AdminCourseBaseSerializer):
    pass


class AdminCourseDetailSerializer(AdminCourseBaseSerializer):
    pass


class AdminCourseWriteSerializer(AdminCourseBaseSerializer):
    class Meta(AdminCourseBaseSerializer.Meta):
        read_only_fields = ("course_id", "created_at", "updated_at", "media")


class AdminCourseParticipantSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    progress_percent = serializers.SerializerMethodField()
    progress_status = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = (
            "user_id",
            "first_name",
            "last_name",
            "email",
            "enrolled_at",
            "progress_percent",
            "progress_status",
        )
        read_only_fields = fields

    def _progress_payload(self, obj):
        if not hasattr(obj, "_admin_participant_progress_payload"):
            obj._admin_participant_progress_payload = build_progress_payload(enrollment=obj)
        return obj._admin_participant_progress_payload

    def get_progress_percent(self, obj):
        return self._progress_payload(obj)["progress_percent"]

    def get_progress_status(self, obj):
        return self._progress_payload(obj)["progress_status"]


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    progress_status = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = ("user_id", "course_id", "progress_status", "is_theory_completed", "enrolled_at")
        read_only_fields = fields

    def get_progress_status(self, obj):
        return build_progress_payload(enrollment=obj)["progress_status"]


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
