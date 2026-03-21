from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountStatus
from courses.models import Course, CourseStatus


class LogoutTestCase(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="test@example.com",
            password="StrongPass123",
            first_name="Test",
            last_name="User",
        )

        refresh = RefreshToken.for_user(self.user)
        self.refresh_token = str(refresh)
        self.access_token = str(refresh.access_token)

        self.logout_url = reverse("auth-logout")

    def test_logout_blacklists_refresh_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

        with self.assertRaises(Exception):
            RefreshToken(self.refresh_token).check_blacklist()

    def test_refresh_token_invalid_after_logout(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

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

    def test_blocked_user_with_valid_access_token_cannot_access_protected_endpoint(self):
        blocked_user = Account.objects.create_user(
            email="blocked@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="User",
            status=AccountStatus.BLOCKED,
        )
        course = Course.objects.create(
            title="Protected course",
            short_description="desc",
            content="# content",
            status=CourseStatus.AVAILABLE,
        )
        refresh = RefreshToken.for_user(blocked_user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        response = self.client.post(reverse("course-enroll", kwargs={"pk": course.id}))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")
