from django.db import transaction
from rest_framework import serializers

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


class SubmitAnswerItemSerializer(serializers.Serializer):
    question = serializers.UUIDField()
    selected_option = serializers.UUIDField()


class TestSubmitSerializer(serializers.Serializer):
    answers = SubmitAnswerItemSerializer(many=True)


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

    return {
        "score": score,
        "is_passed": is_passed,
        "attempt_number": attempt_number,
        "remaining_attempts": max(test.max_attempts - attempt_number, 0),
    }
