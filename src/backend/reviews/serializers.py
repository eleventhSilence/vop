from __future__ import annotations

from rest_framework import serializers

from courses.models import CourseEnrollment
from reviews.models import Review, ReviewStatus


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ("course", "text")

    def validate(self, attrs):
        user = self.context["request"].user
        course = attrs["course"]

        if not CourseEnrollment.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError({"course": "You are not enrolled in this course."})

        if Review.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError({"course": "You have already reviewed this course."})

        return attrs

    def create(self, validated_data):
        return Review.objects.create(
            user=self.context["request"].user,
            status=ReviewStatus.PENDING,
            **validated_data,
        )


class ReviewPublicSerializer(serializers.ModelSerializer):
    user = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Review
        fields = ("id", "user", "text", "created_at")


class ReviewMySerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ("id", "course", "text", "status", "created_at", "updated_at")
