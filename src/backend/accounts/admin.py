from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import Account


@admin.register(Account)
class AccountAdmin(DjangoUserAdmin):
    model = Account

    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "status", "is_staff")
    list_filter = ("role", "status", "is_staff", "is_email_verified")
    search_fields = ("email", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        ("Permissions", {"fields": ("role", "status", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("registered_at", "last_login_at")}),
        ("Verification", {"fields": ("is_email_verified",)}),
    )

    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "first_name", "last_name", "password1", "password2")}),
    )

    readonly_fields = ("registered_at", "last_login_at")