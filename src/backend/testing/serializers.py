from django.db import transaction
from rest_framework import serializers

from courses.models import Course
from progress.utils import sync_enrollment_progress_status
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion, UserAnswer


class CourseTestInfoSerializer(serializers.ModelSerializer):
    has_test = serializers.SerializerMethodField()

    class Meta:
        model = CourseTest
        fields = ("has_test", "title", "description", "passing_score", "max_attempts")

    def get_has_test(self, obj):
        return obj is not None


class EmptyCourseTestInfoSerializer(serializers.Serializer):
    has_test = serializers.BooleanField(default=False)
    title = serializers.CharField(allow_null=True)
    description = serializers.CharField(allow_null=True)
    passing_score = serializers.IntegerField(allow_null=True)
    max_attempts = serializers.IntegerField(allow_null=True)


class AdminCourseTestBaseSerializer(serializers.ModelSerializer):
    test_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.UUIDField(read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CourseTest
        fields = (
            "test_id",
            "course_id",
            "course_title",
            "title",
            "description",
            "passing_score",
            "max_attempts",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("test_id", "course_id", "course_title", "created_at", "updated_at")


class AdminCourseTestListSerializer(AdminCourseTestBaseSerializer):
    pass


class AdminCourseTestDetailSerializer(AdminCourseTestBaseSerializer):
    pass


class AdminCourseTestWriteSerializer(serializers.ModelSerializer):
    test_id = serializers.UUIDField(source="id", read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(source="course", queryset=Course.objects.all())
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CourseTest
        fields = (
            "test_id",
            "course_id",
            "course_title",
            "title",
            "description",
            "passing_score",
            "max_attempts",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("test_id", "course_title", "created_at", "updated_at")

    def validate_course(self, value):
        instance = getattr(self, "instance", None)
        existing_test = CourseTest.objects.filter(course=value)
        if instance is not None:
            existing_test = existing_test.exclude(pk=instance.pk)

        if existing_test.exists():
            raise serializers.ValidationError("This course already has a test.")

        return value

    def validate_passing_score(self, value):
        if value < 1:
            raise serializers.ValidationError("Passing score must be greater than zero.")
        return value

    def validate_max_attempts(self, value):
        if value < 1:
            raise serializers.ValidationError("Max attempts must be greater than zero.")
        return value


class SubmitAnswerItemSerializer(serializers.Serializer):
    question = serializers.UUIDField()
    selected_option = serializers.UUIDField()


class TestSubmitSerializer(serializers.Serializer):
    answers = SubmitAnswerItemSerializer(many=True, allow_empty=False)


class TestSubmitResultSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    is_passed = serializers.BooleanField()
    attempt_number = serializers.IntegerField()
    remaining_attempts = serializers.IntegerField()


class TestAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttempt
        fields = ("id", "score", "is_passed", "attempt_number", "created_at")


def create_attempt_with_answers(*, user, test: CourseTest, answers_data: list[dict]):
    existing_attempts = TestAttempt.objects.filter(user=user, test=test).count()
    if existing_attempts >= test.max_attempts:
        raise serializers.ValidationError("Max attempts exceeded")

    attempt_number = existing_attempts + 1

    question_ids = [item["question"] for item in answers_data]
    if len(question_ids) != len(set(question_ids)):
        raise serializers.ValidationError("Duplicate answers for the same question")
    if len(question_ids) != test.questions.count():
        raise serializers.ValidationError("All test questions must be answered")

    option_ids = [item["selected_option"] for item in answers_data]

    questions = {
        question.id: question
        for question in TestQuestion.objects.filter(test=test, id__in=question_ids)
    }
    options = {option.id: option for option in AnswerOption.objects.filter(id__in=option_ids)}

    score = 0
    user_answers_payload = []
    for item in answers_data:
        question = questions.get(item["question"])
        option = options.get(item["selected_option"])

        if question is None:
            raise serializers.ValidationError("Question does not belong to test")
        if option is None or option.question_id != question.id:
            raise serializers.ValidationError("Selected option does not belong to question")

        if option.is_correct:
            score += 1

        user_answers_payload.append((question, option))

    is_passed = score >= test.passing_score

    with transaction.atomic():
        attempt = TestAttempt.objects.create(
            user=user,
            test=test,
            score=score,
            is_passed=is_passed,
            attempt_number=attempt_number,
        )
        UserAnswer.objects.bulk_create(
            [
                UserAnswer(attempt=attempt, question=question, selected_option=option)
                for question, option in user_answers_payload
            ]
        )

    enrollment = user.course_enrollments.filter(course=test.course).first()
    if enrollment is not None:
        sync_enrollment_progress_status(enrollment=enrollment)

    return {
        "score": score,
        "is_passed": is_passed,
        "attempt_number": attempt_number,
        "remaining_attempts": max(test.max_attempts - attempt_number, 0),
    }
