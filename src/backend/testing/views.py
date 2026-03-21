from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from courses.models import Course
from testing.models import CourseTest, TestAttempt
from testing.serializers import (
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
        course = get_object_or_404(Course, id=self.kwargs["course_id"])
        test = CourseTest.objects.filter(course=course, is_active=True).first()

        if test is None:
            serializer = EmptyCourseTestInfoSerializer(
                {
                    "has_test": False,
                    "title": None,
                    "description": None,
                    "passing_score": None,
                    "max_attempts": None,
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
        return TestAttempt.objects.filter(user=self.request.user, test=test)
