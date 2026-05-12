from __future__ import annotations

from rest_framework import serializers

from courses.models import Course, CourseEnrollment, CourseStatus
from reviews.models import Review, ReviewStatus


class ReviewCreateSerializer(serializers.ModelSerializer):
    review_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(source="course", queryset=Course.objects.all())
    comment = serializers.CharField(source="text")

    class Meta:
        model = Review
        fields = ("review_id", "course_id", "comment", "rating", "status", "created_at", "updated_at")
        read_only_fields = ("review_id", "status", "created_at", "updated_at")

    def to_internal_value(self, data):
        payload = data.copy()
        if "course_id" not in payload and "course" in payload:
            payload["course_id"] = payload["course"]
        if "comment" not in payload and "text" in payload:
            payload["comment"] = payload["text"]
        return super().to_internal_value(payload)

    def validate(self, attrs):
        user = self.context["request"].user
        course = attrs["course"]

        if not CourseEnrollment.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError({"course_id": "You are not enrolled in this course."})

        if Review.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError({"course_id": "You have already reviewed this course."})

        return attrs

    def create(self, validated_data):
        return Review.objects.create(
            user=self.context["request"].user,
            status=ReviewStatus.PENDING,
            **validated_data,
        )


class ReviewUpdateSerializer(serializers.ModelSerializer):
    comment = serializers.CharField(source="text", required=False)

    forbidden_fields = {"user", "course", "status", "created_at", "updated_at", "id"}
    allowed_fields = {"comment", "rating"}

    class Meta:
        model = Review
        fields = ("comment", "rating")

    def to_internal_value(self, data):
        payload = data.copy()
        if "comment" not in payload and "text" in payload:
            payload["comment"] = payload["text"]
        return super().to_internal_value(payload)

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

    def update(self, instance, validated_data):
        text = validated_data.get("text", serializers.empty)
        rating = validated_data.get("rating", serializers.empty)

        content_changed = False

        if text is not serializers.empty and text != instance.text:
            instance.text = text
            content_changed = True

        if rating is not serializers.empty and rating != instance.rating:
            instance.rating = rating
            content_changed = True

        if content_changed:
            instance.status = ReviewStatus.PENDING

        instance.save()
        return instance




class AdminReviewListSerializer(serializers.ModelSerializer):
    review_id = serializers.UUIDField(source="id", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    comment = serializers.CharField(source="text", read_only=True)

    class Meta:
        model = Review
        fields = (
            "review_id",
            "user_id",
            "user_email",
            "course_id",
            "course_title",
            "rating",
            "comment",
            "status",
            "created_at",
            "updated_at",
        )


class AdminReviewStatusUpdateSerializer(serializers.ModelSerializer):
    forbidden_fields = {"user", "course", "rating", "comment", "text", "created_at", "updated_at", "id"}
    allowed_fields = {"status"}

    class Meta:
        model = Review
        fields = ("status",)

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


class ReviewPublicSerializer(serializers.ModelSerializer):
    review_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    author_id = serializers.UUIDField(source="user.id", read_only=True)
    author_name = serializers.SerializerMethodField()
    comment = serializers.CharField(source="text", read_only=True)

    class Meta:
        model = Review
        fields = ("review_id", "course_id", "author_id", "author_name", "comment", "rating", "created_at")

    def get_author_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or None


class ReviewMySerializer(serializers.ModelSerializer):
    review_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.UUIDField(source="course.id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    course_is_available = serializers.SerializerMethodField()
    comment = serializers.CharField(source="text", read_only=True)

    class Meta:
        model = Review
        fields = (
            "review_id",
            "course_id",
            "course_title",
            "course_is_available",
            "comment",
            "rating",
            "status",
            "created_at",
            "updated_at",
        )

    def get_course_is_available(self, obj):
        if not obj.course_id:
            return False
        return obj.course.status == CourseStatus.AVAILABLE


class ReviewAvailableCourseSerializer(serializers.ModelSerializer):
    course_id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(source="course.title", read_only=True)
    short_description = serializers.CharField(source="course.short_description", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = ("course_id", "title", "short_description", "enrolled_at")
