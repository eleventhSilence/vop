from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from courses.models import Course, CourseEnrollment, CourseStatus
from courses.serializers import (
    AdminCourseDetailSerializer,
    AdminCourseListSerializer,
    AdminCourseWriteSerializer,
    CourseDetailSerializer,
    CourseEnrollmentSerializer,
    CourseListSerializer,
    MyCourseSerializer,
)
from reviews.permissions import IsAdminUserRole


class CourseListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseListSerializer

    def get_queryset(self):
        return Course.objects.filter(status=CourseStatus.AVAILABLE)


class MyCourseListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MyCourseSerializer

    def get_queryset(self):
        return CourseEnrollment.objects.filter(user=self.request.user).select_related("course")


class CourseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseDetailSerializer
    queryset = Course.objects.filter(status=CourseStatus.AVAILABLE)


class CourseEnrollView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseEnrollmentSerializer

    def create(self, request, *args, **kwargs):
        course = get_object_or_404(Course, id=self.kwargs["pk"], status=CourseStatus.AVAILABLE)

        if CourseEnrollment.objects.filter(user=request.user, course=course).exists():
            return Response({"detail": "User already enrolled"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = CourseEnrollment.objects.create(user=request.user, course=course)
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminCourseListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Course.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminCourseWriteSerializer
        return AdminCourseListSerializer


class AdminCourseRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    queryset = Course.objects.all()
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminCourseWriteSerializer
        return AdminCourseDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AdminCourseDetailSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
