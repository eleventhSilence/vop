from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import Account


class AccountMeSerializer(serializers.ModelSerializer):
    created_at = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_created_at(self, obj):
        return getattr(obj, "created_at", None)

    def get_updated_at(self, obj):
        return getattr(obj, "updated_at", None)


class AccountMeUpdateSerializer(serializers.ModelSerializer):
    forbidden_fields = {"role", "status", "password", "is_staff", "is_superuser"}
    allowed_fields = {"first_name", "last_name"}

    class Meta:
        model = Account
        fields = ("first_name", "last_name")

    def validate(self, attrs):
        errors = {}

        for field in self.forbidden_fields:
            if field in self.initial_data:
                errors[field] = "This field cannot be updated."

        for field in self.initial_data:
            if field not in self.allowed_fields and field not in self.forbidden_fields:
                errors[field] = "This field cannot be updated."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context["request"].user
        validate_password(value, user=user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=("password",))
        return user
