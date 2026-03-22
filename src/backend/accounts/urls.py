from django.urls import path
from .views import (
    AccountDashboardView,
    AccountMeView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    PublicTokenRefreshView,
    RegisterView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/refresh/", PublicTokenRefreshView.as_view(), name="token_refresh"),
    path("account/me/", AccountMeView.as_view(), name="account-me"),
    path("account/change-password/", ChangePasswordView.as_view(), name="account-change-password"),
    path("account/dashboard/", AccountDashboardView.as_view(), name="account-dashboard"),
]
