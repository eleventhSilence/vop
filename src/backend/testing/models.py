from __future__ import annotations

import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models, transaction

from courses.models import Course


class CourseTest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name="course_test")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    passing_score = models.PositiveIntegerField()
    max_attempts = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "course_tests"

    def __str__(self) -> str:
        return self.title


class TestQuestion(models.Model):
    class QuestionType(models.TextChoices):
        SINGLE_CHOICE = "single_choice", "Single choice"
        MULTIPLE_CHOICE = "multiple_choice", "Multiple choice"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(CourseTest, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    order = models.PositiveIntegerField()
    question_type = models.CharField(
        max_length=32,
        choices=QuestionType.choices,
        default=QuestionType.SINGLE_CHOICE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "test_questions"
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(fields=("test", "order"), name="unique_question_order_per_test"),
        ]

    def __str__(self) -> str:
        return f"{self.test_id}#{self.order}"

    def get_answer_configuration_error(
        self, *, total_options: int, correct_options: int, allow_incomplete: bool = False
    ) -> str | None:
        if total_options == 0:
            return None

        if self.question_type == self.QuestionType.SINGLE_CHOICE:
            if allow_incomplete:
                if correct_options > 1:
                    return "Single choice question must have exactly one correct answer"
                return None

            if correct_options != 1:
                return "Single choice question must have exactly one correct answer"

        if self.question_type == self.QuestionType.MULTIPLE_CHOICE:
            if allow_incomplete:
                return None

            if correct_options < 1:
                return "Multiple choice question must have at least one correct answer"

        return None

    def validate_answer_configuration(
        self,
        *,
        total_options: int | None = None,
        correct_options: int | None = None,
        allow_incomplete: bool = False,
    ) -> None:
        if total_options is None or correct_options is None:
            answer_options = self.answer_options.all()
            total_options = answer_options.count()
            correct_options = answer_options.filter(is_correct=True).count()

        error = self.get_answer_configuration_error(
            total_options=total_options,
            correct_options=correct_options,
            allow_incomplete=allow_incomplete,
        )
        if error is not None:
            raise ValidationError(error)

    def clean(self):
        super().clean()

        if self.pk:
            self.validate_answer_configuration()

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class AnswerOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(TestQuestion, on_delete=models.CASCADE, related_name="answer_options")
    text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "answer_options"
        ordering = ("order", "created_at", "id")
        constraints = [
            models.UniqueConstraint(fields=("question", "order"), name="unique_option_order_per_question"),
        ]

    def __str__(self) -> str:
        return f"{self.question_id}:{self.id}"

    def _get_configuration_counts(self):
        existing_options = self.question.answer_options.exclude(pk=self.pk)
        total_options = existing_options.count() + 1
        correct_options = existing_options.filter(is_correct=True).count() + int(self.is_correct)
        return total_options, correct_options

    def clean(self):
        super().clean()

        if self.question_id is None:
            return

        total_options, correct_options = self._get_configuration_counts()
        error = self.question.get_answer_configuration_error(
            total_options=total_options,
            correct_options=correct_options,
            allow_incomplete=True,
        )
        if error is not None and not (total_options == 1 and correct_options == 0):
            raise ValidationError(error)

    def save(self, *args, **kwargs):
        total_options, correct_options = self._get_configuration_counts()
        self.full_clean()

        with transaction.atomic():
            instance = super().save(*args, **kwargs)
            if not (total_options == 1 and correct_options == 0):
                self.question.validate_answer_configuration(
                    total_options=total_options,
                    correct_options=correct_options,
                    allow_incomplete=True,
                )

        return instance

    def delete(self, *args, **kwargs):
        question = self.question
        remaining_options = question.answer_options.exclude(pk=self.pk)
        total_options = remaining_options.count()
        correct_options = remaining_options.filter(is_correct=True).count()

        with transaction.atomic():
            question.validate_answer_configuration(
                total_options=total_options,
                correct_options=correct_options,
                allow_incomplete=True,
            )
            return super().delete(*args, **kwargs)


class TestAttempt(models.Model):
    class AttemptStatus(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        INTERRUPTED = "interrupted", "Interrupted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="test_attempts")
    test = models.ForeignKey(CourseTest, on_delete=models.CASCADE, related_name="attempts")
    status = models.CharField(max_length=20, choices=AttemptStatus.choices, default=AttemptStatus.COMPLETED)
    score = models.PositiveIntegerField(default=0)
    is_passed = models.BooleanField(default=False)
    attempt_number = models.PositiveIntegerField()
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "test_attempts"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=("user", "test", "attempt_number"), name="unique_attempt_number_per_user_test"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}-{self.test_id}-{self.attempt_number}"


class UserAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(TestAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(TestQuestion, on_delete=models.CASCADE, related_name="user_answers")
    selected_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE, related_name="selected_in_answers")

    class Meta:
        db_table = "user_answers"
        constraints = [
            models.UniqueConstraint(
                fields=("attempt", "question", "selected_option"),
                name="unique_selected_option_per_question_attempt",
            ),
        ]

    def clean(self):
        if self.selected_option.question_id != self.question_id:
            raise ValidationError("Selected option does not belong to question")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
