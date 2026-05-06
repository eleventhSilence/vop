from __future__ import annotations

import os
import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils.text import slugify


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


class CourseMediaType(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"
    DOCUMENT = "document", "Document"


def course_media_upload_to(instance: "CourseMedia", filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return f"courses/{instance.course_id}/{uuid.uuid4().hex}{ext}"


class CourseMedia(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, related_name="media", on_delete=models.CASCADE)
    file = models.FileField(upload_to=course_media_upload_to)
    title = models.CharField(max_length=255)
    slug = models.SlugField()
    media_type = models.CharField(max_length=20, choices=CourseMediaType.choices)
    original_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "course_media"
        ordering = ("-uploaded_at",)
        constraints = [models.UniqueConstraint(fields=("course", "slug"), name="unique_course_media_slug")]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or slugify(Path(self.original_name).stem) or "media"
            slug = base
            suffix = 1
            while CourseMedia.objects.filter(course=self.course, slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{uuid.uuid4().hex[:6] if suffix == 1 else suffix}"
                suffix += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        file_path = self.file.path if self.file else None
        super().delete(*args, **kwargs)
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

