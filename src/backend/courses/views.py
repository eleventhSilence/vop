from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from drf_yasg.utils import swagger_auto_schema

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
        return CourseEnrollment.objects.filter(user=self.request.user).select_related("course").order_by("-enrolled_at")


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


@method_decorator(
    name="get",
    decorator=swagger_auto_schema(
        operation_summary="List courses for admin",
        operation_description=(
            "Returns all courses for admin management. Course lifecycle is managed via the status field; "
            "admin API does not support physical course deletion."
        ),
    ),
)
@method_decorator(
    name="post",
    decorator=swagger_auto_schema(
        operation_summary="Create course",
        operation_description=(
            "Creates a course for admin management. To hide or deactivate a course later, update its status; "
            "do not delete it through admin API."
        ),
    ),
)
class AdminCourseListCreateView(generics.ListCreateAPIView):
    """Admin course management entrypoint without destroy semantics."""

    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Course.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminCourseWriteSerializer
        return AdminCourseListSerializer


@method_decorator(
    name="get",
    decorator=swagger_auto_schema(
        operation_summary="Retrieve course for admin",
        operation_description=(
            "Returns a course for admin management. Admin API intentionally does not provide course deletion; "
            "course lifecycle changes must be done via status."
        ),
    ),
)
@method_decorator(
    name="patch",
    decorator=swagger_auto_schema(
        operation_summary="Update course for admin",
        operation_description=(
            "Updates course fields for admin management. Use status to make a course unavailable instead of deleting it."
        ),
    ),
)
class AdminCourseRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    """Admin course detail endpoint that supports retrieval and partial updates only."""

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
