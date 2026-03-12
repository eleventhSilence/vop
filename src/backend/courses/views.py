from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from courses.models import Course, CourseEnrollment, CourseStatus
from courses.serializers import CourseDetailSerializer, CourseEnrollmentSerializer, CourseListSerializer


class CourseListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseListSerializer

    def get_queryset(self):
        return Course.objects.filter(status=CourseStatus.AVAILABLE)


class CourseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseDetailSerializer
    queryset = Course.objects.all()


class CourseEnrollView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseEnrollmentSerializer

    def create(self, request, *args, **kwargs):
        course = get_object_or_404(Course, id=self.kwargs["pk"])

        if CourseEnrollment.objects.filter(user=request.user, course=course).exists():
            return Response({"detail": "User already enrolled"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = CourseEnrollment.objects.create(user=request.user, course=course)
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
