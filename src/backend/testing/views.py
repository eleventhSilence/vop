from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from django.utils import timezone
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
    TestAttemptDetailSerializer,
    TestSubmitResultSerializer,
    TestSubmitSerializer,
    TestInterruptSerializer,
    create_attempt_with_answers,
    finalize_attempt,
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




class TestAttemptStartView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"], is_active=True)
        enrollment = CourseEnrollment.objects.filter(user=request.user, course=test.course).first()
        if enrollment is None:
            return Response({"detail": "User is not enrolled in this course."}, status=status.HTTP_400_BAD_REQUEST)
        if not enrollment.is_theory_completed:
            return Response({"detail": "Theory must be completed before testing"}, status=status.HTTP_400_BAD_REQUEST)

        active = TestAttempt.objects.filter(user=request.user, test=test, status=TestAttempt.AttemptStatus.IN_PROGRESS).first()
        if active is not None:
            return Response({"attempt_id": active.id, "status": active.status}, status=status.HTTP_200_OK)

        completed_count = TestAttempt.objects.filter(user=request.user, test=test, status__in=[TestAttempt.AttemptStatus.COMPLETED, TestAttempt.AttemptStatus.INTERRUPTED]).count()
        if completed_count >= test.max_attempts:
            return Response({"detail": "Max attempts exceeded."}, status=status.HTTP_400_BAD_REQUEST)

        attempt = TestAttempt.objects.create(user=request.user, test=test, attempt_number=completed_count+1, status=TestAttempt.AttemptStatus.IN_PROGRESS, score=0, is_passed=False)
        return Response({"attempt_id": attempt.id, "status": attempt.status}, status=status.HTTP_201_CREATED)


class TestActiveAttemptView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"], is_active=True)
        attempt = TestAttempt.objects.filter(user=request.user, test=test, status=TestAttempt.AttemptStatus.IN_PROGRESS).first()
        if attempt is None:
            return Response({"active_attempt": None}, status=status.HTTP_200_OK)
        return Response({"active_attempt": {"attempt_id": attempt.id, "status": attempt.status}}, status=status.HTTP_200_OK)

class TestSubmitView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestSubmitSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"], is_active=True)
        attempt_id = request.data.get("attempt_id")
        if attempt_id:
            attempt = get_object_or_404(TestAttempt, id=attempt_id, user=request.user, test=test)
            if attempt.status != TestAttempt.AttemptStatus.IN_PROGRESS:
                return Response({"detail": "Attempt already finalized."}, status=status.HTTP_400_BAD_REQUEST)
            result = finalize_attempt(attempt=attempt, answers_data=serializer.validated_data["answers"], status_value=TestAttempt.AttemptStatus.COMPLETED)
            return Response(TestSubmitResultSerializer(result).data, status=status.HTTP_200_OK)

        enrollment = CourseEnrollment.objects.filter(user=request.user, course=test.course).first()
        if enrollment is None:
            return Response({"detail": "User is not enrolled in this course."}, status=status.HTTP_400_BAD_REQUEST)
        if not enrollment.is_theory_completed:
            return Response({"detail": "Theory must be completed before testing"}, status=status.HTTP_400_BAD_REQUEST)
        result = create_attempt_with_answers(user=request.user, test=test, answers_data=serializer.validated_data["answers"])
        return Response(TestSubmitResultSerializer(result).data, status=status.HTTP_201_CREATED)


class TestAttemptHistoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestAttemptSerializer

    def get_queryset(self):
        test = get_object_or_404(CourseTest, id=self.kwargs["test_id"])
        return TestAttempt.objects.filter(user=self.request.user, test=test).order_by("-created_at", "id")


class TestAttemptDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestAttemptDetailSerializer
    lookup_url_kwarg = "attempt_id"

    def get_queryset(self):
        return TestAttempt.objects.filter(user=self.request.user).select_related("test")


class AdminCourseTestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = CourseTest.objects.select_related("course")

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(course__title__icontains=search))

        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        if status_filter and status_filter != "all":
            if status_filter in {"available", "unavailable"}:
                queryset = queryset.filter(course__status=status_filter)
            elif status_filter in {"active", "inactive"}:
                queryset = queryset.filter(is_active=(status_filter == "active"))

        return queryset.order_by("-created_at", "id")

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
        queryset = TestQuestion.objects.select_related("test")

        test_id = self.request.query_params.get("test_id")
        if test_id:
            queryset = queryset.filter(test_id=test_id)

        return queryset.order_by("test__created_at", "test_id", "order", "created_at", "id")

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
        queryset = AnswerOption.objects.select_related("question").order_by(
            "question__test__created_at", "question__test_id", "question__order", "question_id", "order", "created_at", "id"
        )

        question_id = self.request.query_params.get("question_id")
        if question_id:
            queryset = queryset.filter(question_id=question_id)

        return queryset

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


class TestAttemptInterruptView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TestInterruptSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt = get_object_or_404(TestAttempt, id=self.kwargs["attempt_id"], user=request.user)
        if attempt.status != TestAttempt.AttemptStatus.IN_PROGRESS:
            result = {"attempt_id": attempt.id, "score": attempt.score, "is_passed": attempt.is_passed, "attempt_number": attempt.attempt_number, "remaining_attempts": max(attempt.test.max_attempts - attempt.attempt_number, 0)}
            return Response(TestSubmitResultSerializer(result).data, status=status.HTTP_200_OK)
        result = finalize_attempt(attempt=attempt, answers_data=serializer.validated_data.get("answers", []), status_value=TestAttempt.AttemptStatus.INTERRUPTED)
        return Response(TestSubmitResultSerializer(result).data, status=status.HTTP_200_OK)
