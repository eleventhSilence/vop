from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account


class LogoutTestCase(APITestCase):

    def setUp(self):
        self.user = Account.objects.create_user(
            email="test@example.com",
            password="StrongPass123",
            first_name="Test",
            last_name="User",
        )

        # получаем токены
        refresh = RefreshToken.for_user(self.user)
        self.refresh_token = str(refresh)
        self.access_token = str(refresh.access_token)

        self.logout_url = reverse("auth-logout")  # имя из urls

    def test_logout_blacklists_refresh_token(self):
        # Авторизуемся через access
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

        # Проверяем, что refresh токен теперь заблокирован
        with self.assertRaises(Exception):
            RefreshToken(self.refresh_token).check_blacklist()

    def test_refresh_token_invalid_after_logout(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        # logout
        self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token},
            format="json",
        )

        response = self.client.post(
            reverse("token_refresh"),
            {"refresh": self.refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
