from django.contrib import admin

from courses.models import Course, CourseEnrollment


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "short_description")


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "course", "progress_status", "enrolled_at")
