from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from dto.serializers import RegisterSerializer, LoginSerializer, LogoutSerializer

from drf_yasg.utils import swagger_auto_schema

from accounts.serializers import (
    AccountDashboardSerializer,
    AccountMeSerializer,
    AccountMeUpdateSerializer,
    ChangePasswordSerializer,
)
from accounts.services import build_account_dashboard


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @swagger_auto_schema(request_body=LoginSerializer)
    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Logged out"}, status=status.HTTP_205_RESET_CONTENT)


class AccountMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AccountMeUpdateSerializer
        return AccountMeSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_serializer = AccountMeSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)


class AccountDashboardView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccountDashboardSerializer
    http_method_names = ["get", "head", "options"]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["recent_course_progress_payloads"] = self.dashboard_payload["recent_course_progress_payloads"]
        return context

    def get(self, request, *args, **kwargs):
        self.dashboard_payload = build_account_dashboard(user=request.user)
        serializer = self.get_serializer(self.dashboard_payload)
        return Response(serializer.data, status=status.HTTP_200_OK)
