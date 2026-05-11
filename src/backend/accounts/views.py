from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_yasg.utils import swagger_auto_schema

from rest_framework_simplejwt.views import TokenRefreshView

from accounts.models import Account, AccountRole, AccountStatus
from accounts.serializers import (
    AccountDashboardSerializer,
    AccountMeSerializer,
    AccountMeUpdateSerializer,
    AdminAccountDetailSerializer,
    AdminAccountListSerializer,
    AdminAccountWriteSerializer,
    AdminDashboardSerializer,
    ChangePasswordSerializer,
    PublicUserProfileSerializer,
)
from accounts.services import build_account_dashboard, build_admin_dashboard
from dto.serializers import LoginSerializer, LogoutSerializer, RegisterSerializer
from reviews.permissions import IsAdminUserRole
from reviews.models import ReviewStatus


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


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


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


class AdminDashboardView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = AdminDashboardSerializer
    http_method_names = ["get", "head", "options"]

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(build_admin_dashboard())
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminUserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = AdminAccountListSerializer
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = Account.objects.all().order_by("-registered_at", "email")

        role_filter = (self.request.query_params.get("role") or "").strip()
        if role_filter and role_filter.lower() != "all":
            valid_roles = {choice for choice, _ in AccountRole.choices}
            normalized_role_filter = role_filter.upper()
            if normalized_role_filter not in valid_roles:
                raise ValidationError({"role": "Invalid role."})
            queryset = queryset.filter(role=normalized_role_filter)

        status_filter = (self.request.query_params.get("status") or "").strip()
        if status_filter and status_filter.lower() != "all":
            normalized_status_filter = status_filter.upper()
            status_mapping = {
                "ACTIVE": AccountStatus.ACTIVE,
                "INACTIVE": AccountStatus.BLOCKED,
                AccountStatus.ACTIVE: AccountStatus.ACTIVE,
                AccountStatus.BLOCKED: AccountStatus.BLOCKED,
            }
            mapped_status = status_mapping.get(normalized_status_filter)
            if mapped_status is None:
                raise ValidationError({"status": "Invalid status."})
            queryset = queryset.filter(status=mapped_status)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            search_query = Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            if hasattr(Account, "username"):
                search_query |= Q(username__icontains=search)
            queryset = queryset.filter(search_query)

        return queryset


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return Account.objects.annotate(
            enrolled_courses_count=Count("course_enrollments", distinct=True),
            reviews_count=Count("reviews", distinct=True),
        )

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return AdminAccountWriteSerializer
        return AdminAccountDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        response_instance = self.get_queryset().get(pk=instance.pk)
        response_serializer = AdminAccountDetailSerializer(response_instance)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class PublicUserProfileView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicUserProfileSerializer
    lookup_url_kwarg = "user_id"

    def get_queryset(self):
        return Account.objects.prefetch_related("course_enrollments__course").annotate(
            approved_reviews_count=Count("reviews", filter=Q(reviews__status=ReviewStatus.APPROVED), distinct=True)
        )

    def get_object(self):
        user = get_object_or_404(self.get_queryset(), pk=self.kwargs[self.lookup_url_kwarg])
        latest_reviews = list(
            user.reviews.filter(status=ReviewStatus.APPROVED).select_related("course").order_by("-created_at")[:5]
        )
        user.latest_reviews = latest_reviews
        return user
