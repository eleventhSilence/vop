from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from pathlib import Path
from django.db.models import Exists, OuterRef, Q

from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from drf_yasg.utils import swagger_auto_schema

from courses.models import Course, CourseEnrollment, CourseMedia, CourseMediaType, CourseStatus
from courses.serializers import (
    AdminCourseDetailSerializer,
    AdminCourseListSerializer,
    AdminCourseWriteSerializer,
    CourseDetailSerializer,
    CourseEnrollmentSerializer,
    CourseListSerializer,
    MyCourseSerializer,
    CourseMediaSerializer,
)
from accounts.models import AccountRole
from reviews.permissions import IsAdminUserRole
from testing.models import TestAttempt


class CourseListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseListSerializer

    def get_queryset(self):
        queryset = Course.objects.filter(status=CourseStatus.AVAILABLE)
        if self.request.user.is_authenticated:
            user_enrollment = CourseEnrollment.objects.filter(user=self.request.user, course_id=OuterRef("pk"))
            queryset = queryset.annotate(is_enrolled=Exists(user_enrollment))

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(short_description__icontains=search))

        enrollment = (self.request.query_params.get("enrollment") or "all").strip().lower()
        if self.request.user.is_authenticated and enrollment in {"enrolled", "not_enrolled"}:
            if enrollment == "enrolled":
                queryset = queryset.filter(is_enrolled=True)
            else:
                queryset = queryset.filter(is_enrolled=False)

        return queryset.order_by("-created_at", "id")


class MyCourseListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MyCourseSerializer

    def get_queryset(self):
        queryset = CourseEnrollment.objects.filter(user=self.request.user).select_related("course")

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(course__title__icontains=search) | Q(course__short_description__icontains=search))

        progress = (self.request.query_params.get("progress") or "all").strip().lower()
        passed_attempts = TestAttempt.objects.filter(user=self.request.user, test__course_id=OuterRef("course_id"), is_passed=True)
        any_attempts = TestAttempt.objects.filter(user=self.request.user, test__course_id=OuterRef("course_id"))

        if progress in {"25", "50", "75", "100"}:
            queryset = queryset.annotate(has_any_attempts=Exists(any_attempts), has_passed_attempt=Exists(passed_attempts))
            if progress == "25":
                queryset = queryset.filter(is_theory_completed=False)
            elif progress == "50":
                queryset = queryset.filter(is_theory_completed=True, has_any_attempts=False)
            elif progress == "75":
                queryset = queryset.filter(is_theory_completed=True, has_any_attempts=True, has_passed_attempt=False)
            elif progress == "100":
                queryset = queryset.filter(is_theory_completed=True, has_passed_attempt=True)

        return queryset.order_by("-enrolled_at", "id")


class CourseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseDetailSerializer
    queryset = Course.objects.filter(status=CourseStatus.AVAILABLE)


class MyCourseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseDetailSerializer
    lookup_url_kwarg = "course_id"

    def get_queryset(self):
        queryset = Course.objects.all()
        if self.request.user.role == AccountRole.ADMIN:
            return queryset
        return queryset.filter(enrollments__user=self.request.user).distinct()

    def get_object(self):
        return get_object_or_404(self.get_queryset(), id=self.kwargs["course_id"])


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
        queryset = Course.objects.all()

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(short_description__icontains=search))

        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        if status_filter and status_filter != "all":
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by("-created_at", "id")

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


ALLOWED_BY_TYPE = {
    "image": {"ext": {"jpg", "jpeg", "png", "webp"}, "types": {"image/jpeg", "image/png", "image/webp"}, "max": 5 * 1024 * 1024},
    "video": {"ext": {"mp4"}, "types": {"video/mp4"}, "max": 100 * 1024 * 1024},
    "document": {"ext": {"pdf", "doc", "docx", "ppt", "pptx"}, "types": {"application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"}, "max": 20 * 1024 * 1024},
}
EXT_TO_TYPE = {ext: t for t, conf in ALLOWED_BY_TYPE.items() for ext in conf["ext"]}


def _validate_media_file(uploaded_file):
    ext = Path(uploaded_file.name).suffix.lower().lstrip(".")
    media_type = EXT_TO_TYPE.get(ext)
    if not media_type:
        raise ValidationError({"file": "Неподдерживаемый формат файла."})
    conf = ALLOWED_BY_TYPE[media_type]
    content_type = (uploaded_file.content_type or "").lower()
    if conf["types"] and content_type and content_type not in conf["types"]:
        raise ValidationError({"file": "Неверный MIME-тип файла для выбранного формата."})
    if uploaded_file.size > conf["max"]:
        raise ValidationError({"file": "Размер файла превышает допустимый лимит."})
    return media_type


class AdminCourseMediaListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = CourseMediaSerializer
    parser_classes = (MultiPartParser, FormParser)

    def get_course(self):
        return get_object_or_404(Course, id=self.kwargs["course_id"])

    def get_queryset(self):
        return CourseMedia.objects.filter(course=self.get_course()).order_by("-uploaded_at")

    def create(self, request, *args, **kwargs):
        course = self.get_course()
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Файл обязателен."})
        media_type = _validate_media_file(uploaded)
        title = (request.data.get("title") or Path(uploaded.name).stem).strip()
        media = CourseMedia.objects.create(course=course, file=uploaded, title=title, media_type=media_type, original_name=uploaded.name, file_size=uploaded.size)
        serializer = self.get_serializer(media)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminCourseMediaDestroyView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = CourseMediaSerializer

    def get_queryset(self):
        return CourseMedia.objects.filter(course_id=self.kwargs["course_id"])
