from django.contrib import admin

from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion, UserAnswer


@admin.register(CourseTest)
class CourseTestAdmin(admin.ModelAdmin):
    list_display = ("id", "course", "title", "passing_score", "max_attempts", "is_active", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("title", "course__title")


@admin.register(TestQuestion)
class TestQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "test", "order")
    list_filter = ("test",)
    search_fields = ("text",)


@admin.register(AnswerOption)
class AnswerOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "is_correct")
    list_filter = ("is_correct",)
    search_fields = ("text",)


@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "test", "score", "is_passed", "attempt_number", "created_at")
    list_filter = ("is_passed", "created_at")


@admin.register(UserAnswer)
class UserAnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "attempt", "question", "selected_option")
