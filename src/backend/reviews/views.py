from __future__ import annotations

from rest_framework import generics, permissions

from reviews.models import Review, ReviewStatus
from reviews.serializers import ReviewCreateSerializer, ReviewMySerializer, ReviewPublicSerializer


class ReviewCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewCreateSerializer


class CourseApprovedReviewListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ReviewPublicSerializer

    def get_queryset(self):
        return Review.objects.filter(
            course_id=self.kwargs["course_id"],
            status=ReviewStatus.APPROVED,
        ).select_related("user")


class MyReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewMySerializer

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("course")
