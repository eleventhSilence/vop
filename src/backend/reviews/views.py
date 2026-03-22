from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from reviews.models import Review, ReviewStatus
from reviews.serializers import (
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
        ).select_related("user")


class MyReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewMySerializer

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user).select_related("course")
