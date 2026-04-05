from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from courses.models import Course, CourseEnrollment, CourseStatus
from accounts.models import AccountRole
from reviews.permissions import IsAdminUserRole
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion
from testing.serializers import (
    AdminCourseTestDetailSerializer,
    AdminCourseTestListSerializer,
    AdminCourseTestWriteSerializer,
    AdminAnswerOptionDetailSerializer,
    AdminAnswerOptionListSerializer,
    AdminAnswerOptionWriteSerializer,
    AdminTestQuestionDetailSerializer,
    AdminTestQuestionListSerializer,
    AdminTestQuestionWriteSerializer,
    CourseTestInfoSerializer,
    EmptyCourseTestInfoSerializer,
    TestAttemptSerializer,
    TestSubmitResultSerializer,
    TestSubmitSerializer,
    create_attempt_with_answers,
)


class CourseTestInfoView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        course = get_object_or_404(Course, id=self.kwargs["course_id"], status=CourseStatus.AVAILABLE)
        test = CourseTest.objects.filter(course=course, is_active=True).prefetch_related("questions__answer_options").first()

        if test is None:
            serializer = EmptyCourseTestInfoSerializer(
                {
                    "has_test": False,
                    "test_id": None,
                    "title": None,
                    "description": None,
                    "passing_score": None,
                    "max_attempts": None,
                    "questions": [],
                }
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = CourseTestInfoSerializer(test)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyCourseTestInfoView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        courses = Course.objects.all()
        if request.user.role != AccountRole.ADMIN:
            courses = courses.filter(enrollments__user=request.user).distinct()

        course = get_object_or_404(courses, id=self.kwargs["course_id"])
        test = CourseTest.objects.filter(course=course, is_active=True).prefetch_related("questions__answer_options").first()

        if test is None:
            serializer = EmptyCourseTestInfoSerializer(
                {
                    "has_test": False,
                    "test_id": None,
                    "title": None,
                    "description": None,
                    "passing_score": None,
                    "max_attempts": None,
                    "questions": [],
                }
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = CourseTestInfoSerializer(test)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TestSubmitView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestSubmitSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"], is_active=True)
        enrollment = CourseEnrollment.objects.filter(user=request.user, course=test.course).first()

        if enrollment is None:
            return Response({"detail": "User is not enrolled in this course."}, status=status.HTTP_400_BAD_REQUEST)

        if not enrollment.is_theory_completed:
            return Response(
                {"detail": "Theory must be completed before testing"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = create_attempt_with_answers(
            user=request.user,
            test=test,
            answers_data=serializer.validated_data["answers"],
        )
        output = TestSubmitResultSerializer(result)
        return Response(output.data, status=status.HTTP_201_CREATED)


class TestAttemptHistoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestAttemptSerializer

    def get_queryset(self):
        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"])
        return TestAttempt.objects.filter(user=self.request.user, test=test).order_by("-created_at", "id")


class AdminCourseTestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return CourseTest.objects.select_related("course").order_by("-created_at", "id")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminCourseTestWriteSerializer
        return AdminCourseTestListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        response_serializer = AdminCourseTestDetailSerializer(serializer.instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class AdminCourseTestRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    queryset = CourseTest.objects.select_related("course")
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminCourseTestWriteSerializer
        return AdminCourseTestDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AdminCourseTestDetailSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.attempts.exists():
            return Response(
                {"detail": "Test cannot be deleted because it already has attempts."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if instance.questions.exists():
            return Response(
                {"detail": "Test cannot be deleted because it still has questions. Delete questions first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminTestQuestionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return TestQuestion.objects.select_related("test").order_by("test__created_at", "test_id", "order", "created_at", "id")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminTestQuestionWriteSerializer
        return AdminTestQuestionListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        response_serializer = AdminTestQuestionDetailSerializer(serializer.instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class AdminTestQuestionRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    queryset = TestQuestion.objects.select_related("test")
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminTestQuestionWriteSerializer
        return AdminTestQuestionDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AdminTestQuestionDetailSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.answer_options.exists():
            return Response(
                {"detail": "Question cannot be deleted because it still has answer options. Delete answer options first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminAnswerOptionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return AnswerOption.objects.select_related("question").order_by(
            "question__test__created_at", "question__test_id", "question__order", "question_id", "order", "created_at", "id"
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminAnswerOptionWriteSerializer
        return AdminAnswerOptionListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        response_serializer = AdminAnswerOptionDetailSerializer(serializer.instance)
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class AdminAnswerOptionRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    queryset = AnswerOption.objects.select_related("question")
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminAnswerOptionWriteSerializer
        return AdminAnswerOptionDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AdminAnswerOptionDetailSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        try:
            self.perform_destroy(instance)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
