from __future__ import annotations

from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework.pagination import PageNumberPagination
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from reviews.models import Review, ReviewStatus
from reviews.permissions import IsAdminUserRole
from reviews.serializers import (
    AdminReviewListSerializer,
    ReviewAvailableCourseSerializer,
    AdminReviewStatusUpdateSerializer,
    ReviewCreateSerializer,
    ReviewMySerializer,
    ReviewPublicSerializer,
    ReviewUpdateSerializer,
)
from courses.models import CourseEnrollment, CourseStatus


class ReviewCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewCreateSerializer


class ReviewUpdateView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewUpdateSerializer
    http_method_names = ["patch", "delete", "head", "options"]

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
        queryset = Review.objects.filter(
            course_id=self.kwargs["course_id"],
            status=ReviewStatus.APPROVED,
        ).select_related("user", "course")

        rating = (self.request.query_params.get("rating") or "").strip().lower()
        if rating and rating != "all":
            try:
                rating_value = int(rating)
            except (TypeError, ValueError):
                rating_value = None

            if rating_value in {1, 2, 3, 4, 5}:
                queryset = queryset.filter(rating=rating_value)

        return queryset.order_by("-created_at", "id")


class MyReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewMySerializer
    pagination_class = None

    class Pagination(PageNumberPagination):
        page_size = 5
        page_size_query_param = "page_size"
        max_page_size = 5

    pagination_class = Pagination

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("course").order_by("-created_at", "id")


class AvailableCoursesForReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewAvailableCourseSerializer

    class Pagination(PageNumberPagination):
        page_size = 5
        page_size_query_param = "page_size"
        max_page_size = 5

    pagination_class = Pagination

    def get_queryset(self):
        reviewed_course_ids = Review.objects.filter(user=self.request.user).values("course_id")
        return (
            CourseEnrollment.objects.filter(user=self.request.user, course__status=CourseStatus.AVAILABLE)
            .exclude(course_id__in=reviewed_course_ids)
            .select_related("course")
            .order_by("-enrolled_at", "id")
        )


class AdminReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = AdminReviewListSerializer
    http_method_names = ["get", "head", "options"]

    def get_status_filter(self):
        return self.request.query_params.get("status")

    def get_search_filter(self):
        return self.request.query_params.get("search", "")

    def apply_search_filter(self, queryset):
        search = self.get_search_filter().strip()
        if not search:
            return queryset

        search_query = (
            Q(text__icontains=search)
            | Q(user__email__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(course__title__icontains=search)
        )

        if hasattr(Review.user.field.related_model, "username"):
            search_query |= Q(user__username__icontains=search)

        return queryset.filter(search_query)

    def apply_status_filter(self, queryset):
        status_filter = self.get_status_filter()
        if status_filter is None:
            return queryset

        normalized_status = status_filter.strip().lower()
        if not normalized_status or normalized_status == "all":
            return queryset

        valid_statuses = {choice for choice, _ in ReviewStatus.choices}
        if normalized_status not in valid_statuses:
            raise ValidationError({"status": "Invalid status."})

        return queryset.filter(status=normalized_status)

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "course")
        queryset = self.apply_search_filter(queryset)
        queryset = self.apply_status_filter(queryset)

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
