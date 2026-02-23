from __future__ import annotations

import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class AccountRole(models.TextChoices):
    USER = "USER", "User"
    ADMIN = "ADMIN", "Admin"


class AccountStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    BLOCKED = "BLOCKED", "Blocked"


class AccountManager(BaseUserManager):
    def create_user(self, email: str, password: str | None = None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # хеширование
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("role", AccountRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", AccountStatus.ACTIVE)

        if extra_fields.get("role") != AccountRole.ADMIN:
            raise ValueError("Superuser must have role=ADMIN")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email=email, password=password, **extra_fields)


class Account(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField(unique=True, db_index=True)

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    role = models.CharField(
        max_length=10,
        choices=AccountRole.choices,
        default=AccountRole.USER,
        db_index=True,
    )
    status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
        db_index=True,
    )

    is_email_verified = models.BooleanField(default=False)

    registered_at = models.DateTimeField(default=timezone.now)
    last_login_at = models.DateTimeField(null=True, blank=True)

    # нужно для доступа в Django-admin
    is_staff = models.BooleanField(default=False)

    objects = AccountManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table = "accounts"
        verbose_name = "Account"
        verbose_name_plural = "Accounts"

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"

    @property
    def is_blocked(self) -> bool:
        return self.status == AccountStatus.BLOCKED
