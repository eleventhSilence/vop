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


class AccountMeApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="me@example.com",
            password="StrongPass123",
            first_name="Initial",
            last_name="User",
        )
        self.me_url = reverse("account-me")
        self.change_password_url = reverse("account-change-password")

    def test_get_my_profile_authorized(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.user.id))
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["first_name"], self.user.first_name)
        self.assertEqual(response.data["last_name"], self.user.last_name)
        self.assertEqual(response.data["role"], self.user.role)
        self.assertEqual(response.data["status"], self.user.status)
        self.assertIn("created_at", response.data)
        self.assertIn("updated_at", response.data)

    def test_get_my_profile_requires_auth(self):
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_my_profile_success(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.me_url,
            {"first_name": "Updated", "last_name": "Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Name")

    def test_patch_my_profile_forbids_role_and_status_update(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.me_url,
            {"role": "ADMIN", "status": AccountStatus.BLOCKED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, "USER")
        self.assertEqual(self.user.status, AccountStatus.ACTIVE)
        self.assertEqual(response.data["role"][0], "This field cannot be updated.")
        self.assertEqual(response.data["status"][0], "This field cannot be updated.")

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.change_password_url,
            {"current_password": "StrongPass123", "new_password": "EvenStrongerPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("EvenStrongerPass123"))
        self.assertEqual(response.data["detail"], "Password changed successfully.")

    def test_change_password_fails_with_invalid_current_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.change_password_url,
            {"current_password": "WrongPass123", "new_password": "EvenStrongerPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("StrongPass123"))
        self.assertEqual(response.data["current_password"][0], "Current password is incorrect.")
