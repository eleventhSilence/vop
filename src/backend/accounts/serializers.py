from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.db.models import Exists, OuterRef
from rest_framework import serializers

from accounts.models import Account
from courses.models import CourseEnrollment
from progress.utils import build_progress_payload
from reviews.models import Review
from reviews.serializers import AdminReviewListSerializer
from testing.models import TestAttempt


class AccountMeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = (
            "user_id",
            "email",
            "first_name",
            "last_name",
            "role",
            "status",
            "registered_at",
            "last_login_at",
        )
        read_only_fields = fields

    user_id = serializers.UUIDField(source="id", read_only=True)
    registered_at = serializers.DateTimeField(read_only=True)
    last_login_at = serializers.DateTimeField(read_only=True)


class AccountMeUpdateSerializer(serializers.ModelSerializer):
    forbidden_fields = {"role", "status", "password", "is_staff", "is_superuser"}
    allowed_fields = {"first_name", "last_name"}

    class Meta:
        model = Account
        fields = ("first_name", "last_name")

    def validate(self, attrs):
        errors = {}

        for field in self.forbidden_fields:
            if field in self.initial_data:
                errors[field] = "This field cannot be updated."

        for field in self.initial_data:
            if field not in self.allowed_fields and field not in self.forbidden_fields:
                errors[field] = "This field cannot be updated."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context["request"].user
        validate_password(value, user=user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=("password",))
        return user


class AccountDashboardUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ("user_id", "email", "first_name", "last_name", "role", "status")
        read_only_fields = fields

    user_id = serializers.UUIDField(source="id", read_only=True)


class AccountDashboardStatsSerializer(serializers.Serializer):
    enrolled_courses_count = serializers.IntegerField(read_only=True)
    completed_courses_count = serializers.IntegerField(read_only=True)
    in_progress_courses_count = serializers.IntegerField(read_only=True)


class AccountDashboardRecentCourseSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    title = serializers.CharField(source="course.title", read_only=True)
    short_description = serializers.CharField(source="course.short_description", read_only=True)
    progress_percent = serializers.IntegerField(read_only=True)
    progress_status = serializers.CharField(read_only=True)
    is_test_passed = serializers.BooleanField(read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = (
            "course_id",
            "title",
            "short_description",
            "enrolled_at",
            "progress_percent",
            "progress_status",
            "is_theory_completed",
            "is_test_passed",
        )
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        progress_payload = self.context["recent_course_progress_payloads"][instance.pk]
        data["progress_percent"] = progress_payload["progress_percent"]
        data["progress_status"] = progress_payload["progress_status"]
        data["is_test_passed"] = progress_payload["is_test_passed"]
        return data


class AccountDashboardRecentReviewSerializer(serializers.ModelSerializer):
    review_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    rating = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(source="text", read_only=True)

    class Meta:
        model = Review
        fields = (
            "review_id",
            "course_id",
            "course_title",
            "rating",
            "comment",
            "status",
            "created_at",
        )
        read_only_fields = fields


class AccountDashboardSerializer(serializers.Serializer):
    user = AccountDashboardUserSerializer(read_only=True)
    stats = AccountDashboardStatsSerializer(read_only=True)
    recent_courses = AccountDashboardRecentCourseSerializer(many=True, read_only=True)
    recent_reviews = AccountDashboardRecentReviewSerializer(many=True, read_only=True)


class AdminAccountBaseSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="id", read_only=True)
    registered_at = serializers.DateTimeField(read_only=True)
    last_login_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Account
        fields = (
            "user_id",
            "email",
            "first_name",
            "last_name",
            "role",
            "status",
            "registered_at",
            "last_login_at",
        )
        read_only_fields = fields


class AdminAccountListSerializer(AdminAccountBaseSerializer):
    pass


class AdminAccountDetailSerializer(AdminAccountBaseSerializer):
    enrolled_courses_count = serializers.IntegerField(read_only=True)
    reviews_count = serializers.IntegerField(read_only=True)

    class Meta(AdminAccountBaseSerializer.Meta):
        fields = AdminAccountBaseSerializer.Meta.fields + (
            "enrolled_courses_count",
            "reviews_count",
        )
        read_only_fields = fields


class AdminDashboardUserSummarySerializer(serializers.Serializer):
    total_users = serializers.IntegerField(read_only=True)
    active_users_count = serializers.IntegerField(read_only=True)
    blocked_users_count = serializers.IntegerField(read_only=True)
    admins_count = serializers.IntegerField(read_only=True)
    regular_users_count = serializers.IntegerField(read_only=True)


class AdminDashboardCourseSummarySerializer(serializers.Serializer):
    total_courses = serializers.IntegerField(read_only=True)
    available_courses_count = serializers.IntegerField(read_only=True)
    unavailable_courses_count = serializers.IntegerField(read_only=True)


class AdminDashboardReviewSummarySerializer(serializers.Serializer):
    total_reviews = serializers.IntegerField(read_only=True)
    pending_reviews_count = serializers.IntegerField(read_only=True)
    approved_reviews_count = serializers.IntegerField(read_only=True)
    rejected_reviews_count = serializers.IntegerField(read_only=True)


class AdminDashboardTestingSummarySerializer(serializers.Serializer):
    total_tests = serializers.IntegerField(read_only=True)
    total_questions = serializers.IntegerField(read_only=True)
    total_answer_options = serializers.IntegerField(read_only=True)


class AdminDashboardRecentUserSerializer(AdminAccountBaseSerializer):
    class Meta(AdminAccountBaseSerializer.Meta):
        fields = (
            "user_id",
            "email",
            "first_name",
            "last_name",
            "role",
            "status",
            "registered_at",
        )
        read_only_fields = fields


class AdminDashboardSerializer(serializers.Serializer):
    users = AdminDashboardUserSummarySerializer(read_only=True)
    courses = AdminDashboardCourseSummarySerializer(read_only=True)
    reviews = AdminDashboardReviewSummarySerializer(read_only=True)
    testing = AdminDashboardTestingSummarySerializer(read_only=True)
    recent_users = AdminDashboardRecentUserSerializer(many=True, read_only=True)
    pending_reviews = AdminReviewListSerializer(many=True, read_only=True)


class AdminAccountWriteSerializer(serializers.ModelSerializer):
    allowed_fields = {"role", "status", "first_name", "last_name"}
    forbidden_fields = {
        "email",
        "password",
        "created_at",
        "updated_at",
        "registered_at",
        "last_login_at",
        "is_staff",
        "is_superuser",
        "user_permissions",
        "groups",
        "id",
        "user_id",
    }

    class Meta:
        model = Account
        fields = ("first_name", "last_name", "role", "status")

    def validate(self, attrs):
        errors = {}

        for field in self.forbidden_fields:
            if field in self.initial_data:
                errors[field] = "This field cannot be updated."

        for field in self.initial_data:
            if field not in self.allowed_fields and field not in self.forbidden_fields:
                errors[field] = "This field cannot be updated."

        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        if request is not None and instance is not None and request.user.pk == instance.pk:
            if "status" in attrs and attrs["status"] != instance.status:
                errors["status"] = "You cannot change your own status."
            if "role" in attrs and attrs["role"] != instance.role:
                errors["role"] = "You cannot change your own role."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class PublicUserLatestReviewSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Review
        fields = ("id", "course_id", "course_title", "rating", "text", "created_at")
        read_only_fields = fields


class PublicUserProfileSerializer(serializers.ModelSerializer):
    date_joined = serializers.DateTimeField(source="registered_at", read_only=True)
    completed_courses_count = serializers.SerializerMethodField()
    approved_reviews_count = serializers.IntegerField(read_only=True)
    latest_reviews = PublicUserLatestReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Account
        fields = (
            "id",
            "first_name",
            "last_name",
            "role",
            "date_joined",
            "completed_courses_count",
            "approved_reviews_count",
            "latest_reviews",
        )
        read_only_fields = fields

    def get_completed_courses_count(self, obj: Account) -> int:
        passed_attempts = TestAttempt.objects.filter(
            user=obj,
            test__course=OuterRef("course_id"),
            is_passed=True,
        )
        return (
            CourseEnrollment.objects.filter(user=obj)
            .annotate(has_passed_attempt=Exists(passed_attempts))
            .filter(has_passed_attempt=True)
            .count()
        )
