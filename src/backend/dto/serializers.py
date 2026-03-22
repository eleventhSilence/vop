from __future__ import annotations

from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountStatus


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    user_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = Account
        fields = ("user_id", "email", "first_name", "last_name", "password")
        read_only_fields = ("user_id",)

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = Account.objects.create_user(password=password, **validated_data)
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # сразу выдаём токены после регистрации (удобно для фронта)
        refresh = RefreshToken.for_user(instance)
        data["tokens"] = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(email=email, password=password)
        if not user:
            raise AuthenticationFailed("Invalid email or password.")

        if user.status == AccountStatus.BLOCKED:
            raise AuthenticationFailed("Account is blocked.")

        refresh = RefreshToken.for_user(user)
        return {
            "user": {
                "user_id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "status": user.status,
                "is_email_verified": user.is_email_verified,
            },
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.refresh_token = attrs["refresh"]
        return attrs

    def save(self, **kwargs):
        # blacklisting refresh token
        token = RefreshToken(self.refresh_token)
        token.blacklist()
