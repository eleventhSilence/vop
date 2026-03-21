from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(CourseTest, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    order = models.PositiveIntegerField()

    class Meta:
        db_table = "test_questions"
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(fields=("test", "order"), name="unique_question_order_per_test"),
        ]

    def __str__(self) -> str:
        return f"{self.test_id}#{self.order}"


class AnswerOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(TestQuestion, on_delete=models.CASCADE, related_name="answer_options")
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        db_table = "answer_options"

    def __str__(self) -> str:
        return f"{self.question_id}:{self.id}"


class TestAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="test_attempts")
    test = models.ForeignKey(CourseTest, on_delete=models.CASCADE, related_name="attempts")
    score = models.PositiveIntegerField()
    is_passed = models.BooleanField(default=False)
    attempt_number = models.PositiveIntegerField()
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
            models.UniqueConstraint(fields=("attempt", "question"), name="unique_question_per_attempt"),
        ]

    def clean(self):
        if self.selected_option.question_id != self.question_id:
            raise ValidationError("Selected option does not belong to question")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
