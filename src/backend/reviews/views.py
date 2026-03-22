from __future__ import annotations

from django.db.models import Case, IntegerField, Value, When
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from reviews.models import Review, ReviewStatus
from reviews.permissions import IsAdminUserRole
from reviews.serializers import (
    AdminReviewListSerializer,
    AdminReviewStatusUpdateSerializer,
    ReviewCreateSerializer,
    ReviewMySerializer,
    ReviewPublicSerializer,
    ReviewUpdateSerializer,
)


class ReviewCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewCreateSerializer


class ReviewUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewUpdateSerializer
    http_method_names = ["patch", "head", "options"]

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("course")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = ReviewMySerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class CourseApprovedReviewListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ReviewPublicSerializer

    def get_queryset(self):
        return Review.objects.filter(
            course_id=self.kwargs["course_id"],
            status=ReviewStatus.APPROVED,
        ).select_related("user").order_by("-created_at", "id")


class MyReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewMySerializer

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("course").order_by("-created_at", "id")


class AdminReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = AdminReviewListSerializer
    http_method_names = ["get", "head", "options"]

    def get_status_filter(self):
        return self.request.query_params.get("status")

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "course")
        status_filter = self.get_status_filter()

        if status_filter is not None:
            valid_statuses = {choice for choice, _ in ReviewStatus.choices}
            if status_filter not in valid_statuses:
                raise ValidationError({"status": "Invalid status."})
            queryset = queryset.filter(status=status_filter)

        moderation_priority = Case(
            When(status=ReviewStatus.PENDING, then=Value(0)),
            When(status=ReviewStatus.APPROVED, then=Value(1)),
            When(status=ReviewStatus.REJECTED, then=Value(2)),
            default=Value(3),
            output_field=IntegerField(),
        )

        return queryset.order_by(moderation_priority, "-created_at", "id")


class AdminPendingReviewListView(AdminReviewListView):
    def get_status_filter(self):
        return ReviewStatus.PENDING


class AdminReviewModerationView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = AdminReviewStatusUpdateSerializer
    queryset = Review.objects.select_related("user", "course")
    http_method_names = ["patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AdminReviewListSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
