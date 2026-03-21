from django.urls import path
from .views import AccountMeView, ChangePasswordView, RegisterView, LoginView, LogoutView
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("account/me/", AccountMeView.as_view(), name="account-me"),
    path("account/change-password/", ChangePasswordView.as_view(), name="account-change-password"),
]
