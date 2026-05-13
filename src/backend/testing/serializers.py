from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from courses.models import Course
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion, UserAnswer


class PublicAnswerOptionSerializer(serializers.ModelSerializer):
    option_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = AnswerOption
        fields = ("option_id", "text")


class PublicTestQuestionSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(source="id", read_only=True)
    options = PublicAnswerOptionSerializer(source="answer_options", many=True, read_only=True)

    class Meta:
        model = TestQuestion
        fields = ("question_id", "text", "order", "question_type", "options")


class CourseTestInfoSerializer(serializers.ModelSerializer):
    has_test = serializers.SerializerMethodField()
    test_id = serializers.UUIDField(source="id", read_only=True)
    questions = PublicTestQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseTest
        fields = ("has_test", "test_id", "title", "description", "passing_score", "max_attempts", "questions")

    def get_has_test(self, obj):
        return obj is not None


class EmptyCourseTestInfoSerializer(serializers.Serializer):
    has_test = serializers.BooleanField(default=False)
    test_id = serializers.UUIDField(allow_null=True)
    title = serializers.CharField(allow_null=True)
    description = serializers.CharField(allow_null=True)
    passing_score = serializers.IntegerField(allow_null=True)
    max_attempts = serializers.IntegerField(allow_null=True)
    questions = serializers.ListField(child=serializers.DictField(), allow_empty=True, default=list)


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


class AdminTestAttemptListSerializer(serializers.ModelSerializer):
    attempt_id = serializers.UUIDField(source="id", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    max_score = serializers.IntegerField(source="test.passing_score", read_only=True)

    class Meta:
        model = TestAttempt
        fields = (
            "attempt_id",
            "user_id",
            "first_name",
            "last_name",
            "email",
            "attempt_number",
            "status",
            "is_passed",
            "score",
            "max_score",
            "started_at",
            "completed_at",
        )


class AdminAttemptOptionSerializer(serializers.ModelSerializer):
    option_id = serializers.UUIDField(source="id", read_only=True)
    is_selected = serializers.SerializerMethodField()

    class Meta:
        model = AnswerOption
        fields = ("option_id", "text", "is_correct", "is_selected")

    def get_is_selected(self, obj):
        selected_option_ids = self.context.get("selected_option_ids", set())
        return obj.id in selected_option_ids


class AdminAttemptQuestionSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(source="id", read_only=True)
    is_correct = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()

    class Meta:
        model = TestQuestion
        fields = ("question_id", "order", "text", "question_type", "is_correct", "options")

    def get_is_correct(self, obj):
        correct_option_ids_by_question = self.context["correct_option_ids_by_question"]
        selected_option_ids_by_question = self.context["selected_option_ids_by_question"]
        return selected_option_ids_by_question.get(obj.id, set()) == correct_option_ids_by_question.get(obj.id, set())

    def get_options(self, obj):
        selected_option_ids_by_question = self.context["selected_option_ids_by_question"]
        serializer = AdminAttemptOptionSerializer(
            obj.answer_options.all(),
            many=True,
            context={"selected_option_ids": selected_option_ids_by_question.get(obj.id, set())},
        )
        return serializer.data


class AdminTestAttemptDetailSerializer(serializers.ModelSerializer):
    attempt_id = serializers.UUIDField(source="id", read_only=True)
    result = serializers.SerializerMethodField()
    max_score = serializers.IntegerField(source="test.questions.count", read_only=True)
    user = serializers.SerializerMethodField()
    test = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()

    class Meta:
        model = TestAttempt
        fields = (
            "attempt_id",
            "attempt_number",
            "status",
            "result",
            "score",
            "max_score",
            "started_at",
            "completed_at",
            "user",
            "test",
            "course",
            "questions",
        )

    def get_result(self, obj):
        if obj.status == TestAttempt.AttemptStatus.IN_PROGRESS:
            return None
        return "passed" if obj.is_passed else "failed"

    def get_user(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return {
            "user_id": obj.user_id,
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
            "full_name": full_name,
            "email": obj.user.email,
        }

    def get_test(self, obj):
        return {"test_id": obj.test_id, "title": obj.test.title}

    def get_course(self, obj):
        return {"course_id": obj.test.course_id, "title": obj.test.course.title}

    def get_questions(self, obj):
        questions = list(obj.test.questions.prefetch_related("answer_options").order_by("order", "created_at", "id"))
        selected_option_ids_by_question = {}
        for answer in obj.answers.select_related("question", "selected_option"):
            selected_option_ids_by_question.setdefault(answer.question_id, set()).add(answer.selected_option_id)
        correct_option_ids_by_question = {
            question.id: set(question.answer_options.filter(is_correct=True).values_list("id", flat=True))
            for question in questions
        }
        serializer = AdminAttemptQuestionSerializer(
            questions,
            many=True,
            context={
                "selected_option_ids_by_question": selected_option_ids_by_question,
                "correct_option_ids_by_question": correct_option_ids_by_question,
            },
        )
        return serializer.data

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


class AdminTestQuestionBaseSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(source="id", read_only=True)
    test_id = serializers.UUIDField(read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)

    class Meta:
        model = TestQuestion
        fields = (
            "question_id",
            "test_id",
            "test_title",
            "text",
            "order",
            "question_type",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "question_id",
            "test_id",
            "test_title",
            "created_at",
            "updated_at",
        )


class AdminTestQuestionListSerializer(AdminTestQuestionBaseSerializer):
    pass


class AdminTestQuestionDetailSerializer(AdminTestQuestionBaseSerializer):
    pass


class AdminTestQuestionWriteSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(source="id", read_only=True)
    test_id = serializers.PrimaryKeyRelatedField(source="test", queryset=CourseTest.objects.all())
    test_title = serializers.CharField(source="test.title", read_only=True)

    class Meta:
        model = TestQuestion
        fields = (
            "question_id",
            "test_id",
            "test_title",
            "text",
            "order",
            "question_type",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("question_id", "test_title", "created_at", "updated_at")

    def validate(self, attrs):
        test = attrs.get("test", getattr(self.instance, "test", None))
        order = attrs.get("order", getattr(self.instance, "order", None))
        question_type = attrs.get("question_type", getattr(self.instance, "question_type", TestQuestion.QuestionType.SINGLE_CHOICE))

        if test is not None and order is not None:
            existing_question = TestQuestion.objects.filter(test=test, order=order)
            if self.instance is not None:
                existing_question = existing_question.exclude(pk=self.instance.pk)

            if existing_question.exists():
                raise serializers.ValidationError({"order": "Question order must be unique within the test."})

        if self.instance is not None:
            correct_options = self.instance.answer_options.filter(is_correct=True).count()
            total_options = self.instance.answer_options.count()
            error = TestQuestion(question_type=question_type).get_answer_configuration_error(
                total_options=total_options,
                correct_options=correct_options,
            )
            if error is not None:
                raise serializers.ValidationError({"question_type": error})

        return attrs


class AdminAnswerOptionBaseSerializer(serializers.ModelSerializer):
    option_id = serializers.UUIDField(source="id", read_only=True)
    question_id = serializers.UUIDField(read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)

    class Meta:
        model = AnswerOption
        fields = (
            "option_id",
            "question_id",
            "question_text",
            "text",
            "is_correct",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "option_id",
            "question_id",
            "question_text",
            "created_at",
            "updated_at",
        )


class AdminAnswerOptionListSerializer(AdminAnswerOptionBaseSerializer):
    pass


class AdminAnswerOptionDetailSerializer(AdminAnswerOptionBaseSerializer):
    pass


class AdminAnswerOptionWriteSerializer(serializers.ModelSerializer):
    option_id = serializers.UUIDField(source="id", read_only=True)
    question_id = serializers.PrimaryKeyRelatedField(source="question", queryset=TestQuestion.objects.all())
    question_text = serializers.CharField(source="question.text", read_only=True)

    class Meta:
        model = AnswerOption
        fields = (
            "option_id",
            "question_id",
            "question_text",
            "text",
            "is_correct",
            "order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("option_id", "question_text", "created_at", "updated_at")

    def validate(self, attrs):
        question = attrs.get("question", getattr(self.instance, "question", None))
        is_correct = attrs.get("is_correct", getattr(self.instance, "is_correct", False))
        order = attrs.get("order", getattr(self.instance, "order", None))

        if question is None:
            return attrs

        if order is not None and order <= 0:
            raise serializers.ValidationError({"order": "Order must be greater than 0"})

        existing_options = question.answer_options.all()
        if self.instance is not None:
            existing_options = existing_options.exclude(pk=self.instance.pk)

        total_options = existing_options.count() + 1
        correct_options = existing_options.filter(is_correct=True).count() + int(is_correct)
        error = question.get_answer_configuration_error(
            total_options=total_options,
            correct_options=correct_options,
            allow_incomplete=True,
        )

        if error is not None:
            raise serializers.ValidationError({"is_correct": error})

        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            if exc.message_dict:
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages[0]})

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            if exc.message_dict:
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages[0]})


class SubmitAnswerItemSerializer(serializers.Serializer):
    question_id = serializers.UUIDField(source="question", required=False)
    question = serializers.UUIDField(write_only=True, required=False)
    selected_option_id = serializers.UUIDField(source="selected_option", required=False)
    selected_option = serializers.UUIDField(write_only=True, required=False)
    selected_option_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
    )

    def validate(self, attrs):
        if "question" not in attrs:
            raise serializers.ValidationError({"question_id": "This field is required."})

        has_single = "selected_option" in attrs
        has_multiple = "selected_option_ids" in attrs

        if has_single == has_multiple:
            raise serializers.ValidationError(
                {"detail": "Provide either selected_option_id or selected_option_ids according to question_type."}
            )

        return attrs

    def to_internal_value(self, data):
        if "question_id" not in data and "question" in data:
            data = {**data, "question_id": data["question"]}
        if "selected_option_id" not in data and "selected_option" in data:
            data = {**data, "selected_option_id": data["selected_option"]}
        return super().to_internal_value(data)


class TestSubmitSerializer(serializers.Serializer):
    answers = SubmitAnswerItemSerializer(many=True, allow_empty=True)


class InterruptAnswerItemSerializer(serializers.Serializer):
    question_id = serializers.UUIDField(source="question", required=False)
    question = serializers.UUIDField(write_only=True, required=False)
    selected_option_id = serializers.UUIDField(source="selected_option", required=False)
    selected_option = serializers.UUIDField(write_only=True, required=False)
    selected_option_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=True)

    def validate(self, attrs):
        if "question" not in attrs:
            raise serializers.ValidationError({"question_id": "This field is required."})
        return attrs

    def to_internal_value(self, data):
        if "question_id" not in data and "question" in data:
            data = {**data, "question_id": data["question"]}
        if "selected_option_id" not in data and "selected_option" in data:
            data = {**data, "selected_option_id": data["selected_option"]}
        return super().to_internal_value(data)


class TestInterruptSerializer(serializers.Serializer):
    answers = InterruptAnswerItemSerializer(many=True, allow_empty=True, required=False, default=list)


class TestAttemptStartSerializer(serializers.Serializer):
    attempt_id = serializers.UUIDField(source="id")
    status = serializers.CharField()


class TestSubmitResultSerializer(serializers.Serializer):
    attempt_id = serializers.UUIDField()
    score = serializers.IntegerField()
    is_passed = serializers.BooleanField()
    attempt_number = serializers.IntegerField()
    remaining_attempts = serializers.IntegerField()


class TestAttemptSerializer(serializers.ModelSerializer):
    status = serializers.CharField()

    attempt_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = TestAttempt
        fields = ("attempt_id", "status", "score", "is_passed", "attempt_number", "created_at", "started_at", "completed_at")


class AttemptDetailOptionSerializer(serializers.Serializer):
    option_id = serializers.UUIDField(source="selected_option.id", read_only=True)
    text = serializers.CharField(source="selected_option.text", read_only=True)
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        return "success" if obj.selected_option.is_correct else "error"


class AttemptDetailQuestionSerializer(serializers.Serializer):
    unanswered = serializers.SerializerMethodField()
    question_id = serializers.UUIDField(source="id", read_only=True)
    text = serializers.CharField(read_only=True)
    order = serializers.IntegerField(read_only=True)
    question_type = serializers.CharField(read_only=True)
    result = serializers.SerializerMethodField()
    selected_options = serializers.SerializerMethodField()

    def get_selected_options(self, obj):
        answers_map = self.context.get("answers_map", {})
        selected_answers = answers_map.get(obj.id, [])
        return AttemptDetailOptionSerializer(selected_answers, many=True).data

    def get_result(self, obj):
        correct_option_ids_map = self.context.get("correct_option_ids_map", {})
        answers_map = self.context.get("answers_map", {})
        selected_ids = {answer.selected_option_id for answer in answers_map.get(obj.id, [])}
        if not selected_ids:
            return "unanswered"
        return "success" if selected_ids == correct_option_ids_map.get(obj.id, set()) else "error"


    def get_unanswered(self, obj):
        answers_map = self.context.get("answers_map", {})
        return len(answers_map.get(obj.id, [])) == 0


class TestAttemptDetailSerializer(serializers.ModelSerializer):
    attempt_id = serializers.UUIDField(source="id", read_only=True)
    percent = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()

    class Meta:
        model = TestAttempt
        fields = ("attempt_id", "status", "created_at", "started_at", "completed_at", "score", "percent", "is_passed", "attempt_number", "questions")

    def get_percent(self, obj):
        total_questions = obj.test.questions.count()
        if total_questions == 0:
            return 0
        return round((obj.score / total_questions) * 100, 2)

    def get_questions(self, obj):
        questions = list(obj.test.questions.prefetch_related("answer_options").order_by("order", "created_at", "id"))
        user_answers = (
            obj.answers.select_related("selected_option", "question")
            .order_by("question__order", "selected_option__order", "selected_option__created_at", "selected_option_id")
        )
        answers_map = {}
        for answer in user_answers:
            answers_map.setdefault(answer.question_id, []).append(answer)

        correct_option_ids_map = {
            question.id: set(question.answer_options.filter(is_correct=True).values_list("id", flat=True))
            for question in questions
        }
        serializer = AttemptDetailQuestionSerializer(
            questions,
            many=True,
            context={"answers_map": answers_map, "correct_option_ids_map": correct_option_ids_map},
        )
        return serializer.data


def _normalize_selected_option_ids(item: dict, *, question: TestQuestion, allow_unanswered: bool = False) -> list:
    if question.question_type == TestQuestion.QuestionType.SINGLE_CHOICE:
        if "selected_option_ids" in item:
            raise serializers.ValidationError({"selected_option_id": "Single choice question expects selected_option_id."})
        if "selected_option" not in item:
            return [] if allow_unanswered else (_ for _ in ()).throw(serializers.ValidationError({"selected_option_id": "Single choice question expects selected_option_id."}))
        return [item["selected_option"]]

    if "selected_option" in item:
        raise serializers.ValidationError({"selected_option_ids": "Multiple choice question expects selected_option_ids."})
    if "selected_option_ids" not in item:
        return [] if allow_unanswered else (_ for _ in ()).throw(serializers.ValidationError({"selected_option_ids": "Multiple choice question expects selected_option_ids."}))

    selected_option_ids = item["selected_option_ids"]
    if len(selected_option_ids) != len(set(selected_option_ids)):
        raise serializers.ValidationError({"selected_option_ids": "Duplicate selected options are not allowed."})
    return selected_option_ids


def _validate_and_score_answers(*, test: CourseTest, answers_data: list[dict], allow_unanswered: bool = True):
    question_ids = [item["question"] for item in answers_data]
    if len(question_ids) != len(set(question_ids)):
        raise serializers.ValidationError({"answers": "Duplicate answers for the same question."})

    questions = {
        question.id: question
        for question in TestQuestion.objects.filter(test=test).prefetch_related("answer_options")
    }

    provided_ids = set(question_ids)
    unknown_ids = [qid for qid in provided_ids if qid not in questions]
    if unknown_ids:
        raise serializers.ValidationError({"question_id": "Question does not belong to test."})

    all_option_ids = []
    by_question = {item["question"]: item for item in answers_data}
    normalized_answers = []
    for question in questions.values():
        item = by_question.get(question.id)
        if item is None:
            normalized_answers.append((question, []))
            continue
        selected_option_ids = _normalize_selected_option_ids(item, question=question, allow_unanswered=allow_unanswered)
        all_option_ids.extend(selected_option_ids)
        normalized_answers.append((question, selected_option_ids))

    options = {option.id: option for option in AnswerOption.objects.filter(id__in=all_option_ids)}

    score = 0
    user_answers_payload = []
    for question, selected_option_ids in normalized_answers:
        selected_options = []
        for option_id in selected_option_ids:
            option = options.get(option_id)
            if option is None or option.question_id != question.id:
                raise serializers.ValidationError({"selected_option_id": "Selected option does not belong to question."})
            selected_options.append(option)

        correct_option_ids = set(question.answer_options.filter(is_correct=True).values_list("id", flat=True))
        question.validate_answer_configuration(total_options=question.answer_options.count(), correct_options=len(correct_option_ids))

        if {option.id for option in selected_options} == correct_option_ids:
            score += 1

        user_answers_payload.extend(UserAnswer(attempt=None, question=question, selected_option=option) for option in selected_options)

    return score, user_answers_payload


def create_attempt_with_answers(*, user, test: CourseTest, answers_data: list[dict]):
    existing_attempts = TestAttempt.objects.filter(user=user, test=test, status__in=[TestAttempt.AttemptStatus.COMPLETED, TestAttempt.AttemptStatus.INTERRUPTED]).count()
    if existing_attempts >= test.max_attempts:
        raise serializers.ValidationError({"detail": "Max attempts exceeded."})

    attempt_number = existing_attempts + 1
    score, user_answers_payload = _validate_and_score_answers(test=test, answers_data=answers_data, allow_unanswered=False)
    is_passed = score >= test.passing_score

    with transaction.atomic():
        attempt = TestAttempt.objects.create(user=user, test=test, score=score, is_passed=is_passed, attempt_number=attempt_number, status=TestAttempt.AttemptStatus.COMPLETED)
        for user_answer in user_answers_payload:
            user_answer.attempt = attempt
        UserAnswer.objects.bulk_create(user_answers_payload)

    return {"attempt_id": attempt.id, "score": score, "is_passed": is_passed, "attempt_number": attempt_number, "remaining_attempts": max(test.max_attempts - attempt_number, 0)}


def finalize_attempt(*, attempt: TestAttempt, answers_data: list[dict], status_value: str):
    score, user_answers_payload = _validate_and_score_answers(test=attempt.test, answers_data=answers_data, allow_unanswered=(status_value == TestAttempt.AttemptStatus.INTERRUPTED))
    is_passed = score >= attempt.test.passing_score
    from django.utils import timezone
    with transaction.atomic():
        attempt.answers.all().delete()
        attempt.score = score
        attempt.is_passed = is_passed
        attempt.status = status_value
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=["score", "is_passed", "status", "completed_at"])
        for user_answer in user_answers_payload:
            user_answer.attempt = attempt
        UserAnswer.objects.bulk_create(user_answers_payload)
    return {"attempt_id": attempt.id, "score": score, "is_passed": is_passed, "attempt_number": attempt.attempt_number, "remaining_attempts": max(attempt.test.max_attempts - attempt.attempt_number, 0)}
