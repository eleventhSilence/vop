from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class CourseStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    UNAVAILABLE = "unavailable", "Unavailable"


class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    short_description = models.CharField(max_length=500)
    content = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=CourseStatus.choices,
        default=CourseStatus.AVAILABLE,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "courses"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title


class CourseEnrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="course_enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    # Legacy field kept for backward compatibility. Business logic and API responses use computed progress.
    progress_status = models.CharField(max_length=50, default="enrolled")
    is_theory_completed = models.BooleanField(default=False)
    theory_completed_at = models.DateTimeField(null=True, blank=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "course_enrollments"
        constraints = [
            models.UniqueConstraint(fields=("user", "course"), name="unique_user_course_enrollment"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} -> {self.course_id}"
