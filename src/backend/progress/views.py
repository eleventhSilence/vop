from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from courses.models import CourseEnrollment
from progress.serializers import CompleteTheorySerializer, CourseProgressDetailSerializer, CourseProgressSerializer
from progress.utils import sync_enrollment_progress_status


class MyCourseProgressListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseProgressSerializer

    def get_queryset(self):
        return CourseEnrollment.objects.filter(user=self.request.user).select_related("course").order_by("-enrolled_at")


class CourseProgressDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseProgressDetailSerializer
    lookup_url_kwarg = "course_id"

    def get_queryset(self):
        return CourseEnrollment.objects.filter(user=self.request.user).select_related("course")

    def get_object(self):
        return get_object_or_404(self.get_queryset(), course_id=self.kwargs["course_id"])


class CompleteTheoryView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CompleteTheorySerializer

    def post(self, request, *args, **kwargs):
        enrollment = get_object_or_404(
            CourseEnrollment.objects.select_related("course"),
            user=request.user,
            course_id=self.kwargs["course_id"],
        )

        if not enrollment.is_theory_completed:
            enrollment.is_theory_completed = True
            enrollment.theory_completed_at = timezone.now()
            enrollment.save(update_fields=("is_theory_completed", "theory_completed_at"))

        sync_enrollment_progress_status(enrollment=enrollment)

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_200_OK)
