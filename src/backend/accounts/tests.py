from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountRole, AccountStatus
from courses.models import Course, CourseEnrollment, CourseStatus
from reviews.models import Review, ReviewStatus
from testing.models import CourseTest, TestAttempt


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

    def test_put_my_profile_is_not_allowed(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.put(
            self.me_url,
            {"first_name": "Updated", "last_name": "Name", "email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

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


class AccountDashboardApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="dashboard@example.com",
            password="StrongPass123",
            first_name="Dash",
            last_name="Board",
        )
        self.other_user = Account.objects.create_user(
            email="other-dashboard@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="User",
        )
        self.dashboard_url = reverse("account-dashboard")

        self.course_1 = Course.objects.create(
            title="Course 1",
            short_description="Description 1",
            content="# content 1",
            status=CourseStatus.AVAILABLE,
        )
        self.course_2 = Course.objects.create(
            title="Course 2",
            short_description="Description 2",
            content="# content 2",
            status=CourseStatus.AVAILABLE,
        )
        self.course_3 = Course.objects.create(
            title="Course 3",
            short_description="Description 3",
            content="# content 3",
            status=CourseStatus.AVAILABLE,
        )
        self.course_4 = Course.objects.create(
            title="Course 4",
            short_description="Description 4",
            content="# content 4",
            status=CourseStatus.AVAILABLE,
        )
        self.other_course = Course.objects.create(
            title="Other course",
            short_description="Other description",
            content="# other",
            status=CourseStatus.AVAILABLE,
        )

        self.enrollment_1 = CourseEnrollment.objects.create(
            user=self.user,
            course=self.course_1,
            is_theory_completed=True,
            progress_status="enrolled",
        )
        self.enrollment_2 = CourseEnrollment.objects.create(
            user=self.user,
            course=self.course_2,
            is_theory_completed=True,
            progress_status="enrolled",
        )
        self.enrollment_3 = CourseEnrollment.objects.create(
            user=self.user,
            course=self.course_3,
            is_theory_completed=True,
            progress_status="completed",
        )
        self.enrollment_4 = CourseEnrollment.objects.create(
            user=self.user,
            course=self.course_4,
            progress_status="completed",
        )
        self.other_enrollment = CourseEnrollment.objects.create(user=self.other_user, course=self.other_course)

        now = timezone.now()
        CourseEnrollment.objects.filter(pk=self.enrollment_1.pk).update(enrolled_at=now - timedelta(days=4))
        CourseEnrollment.objects.filter(pk=self.enrollment_2.pk).update(enrolled_at=now - timedelta(days=3))
        CourseEnrollment.objects.filter(pk=self.enrollment_3.pk).update(enrolled_at=now - timedelta(days=2))
        CourseEnrollment.objects.filter(pk=self.enrollment_4.pk).update(enrolled_at=now - timedelta(days=1))
        CourseEnrollment.objects.filter(pk=self.other_enrollment.pk).update(enrolled_at=now)

        self.test_1 = CourseTest.objects.create(
            course=self.course_1,
            title="Test 1",
            description="Desc 1",
            passing_score=2,
            max_attempts=3,
            is_active=True,
        )
        self.test_2 = CourseTest.objects.create(
            course=self.course_2,
            title="Test 2",
            description="Desc 2",
            passing_score=2,
            max_attempts=3,
            is_active=True,
        )

        TestAttempt.objects.create(user=self.user, test=self.test_1, score=2, is_passed=True, attempt_number=1)
        TestAttempt.objects.create(user=self.user, test=self.test_2, score=1, is_passed=False, attempt_number=1)

        self.review_1 = Review.objects.create(
            user=self.user,
            course=self.course_1,
            text="Review 1",
            rating=1,
            status=ReviewStatus.PENDING,
        )
        self.review_2 = Review.objects.create(
            user=self.user,
            course=self.course_2,
            text="Review 2",
            rating=2,
            status=ReviewStatus.APPROVED,
        )
        self.review_3 = Review.objects.create(
            user=self.user,
            course=self.course_3,
            text="Review 3",
            rating=3,
            status=ReviewStatus.REJECTED,
        )
        self.review_4 = Review.objects.create(
            user=self.user,
            course=self.course_4,
            text="Review 4",
            rating=4,
            status=ReviewStatus.PENDING,
        )
        self.other_review = Review.objects.create(
            user=self.other_user,
            course=self.other_course,
            text="Other review",
            rating=5,
            status=ReviewStatus.APPROVED,
        )

        Review.objects.filter(pk=self.review_1.pk).update(created_at=now - timedelta(days=4))
        Review.objects.filter(pk=self.review_2.pk).update(created_at=now - timedelta(days=3))
        Review.objects.filter(pk=self.review_3.pk).update(created_at=now - timedelta(days=2))
        Review.objects.filter(pk=self.review_4.pk).update(created_at=now - timedelta(days=1))
        Review.objects.filter(pk=self.other_review.pk).update(created_at=now)

    def test_dashboard_requires_auth(self):
        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_returns_only_authenticated_user_data(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["id"], str(self.user.id))
        self.assertEqual(response.data["user"]["email"], self.user.email)
        self.assertNotEqual(response.data["user"]["id"], str(self.other_user.id))

    def test_dashboard_stats_are_calculated_correctly(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["stats"],
            {
                "enrolled_courses_count": 4,
                "completed_courses_count": 1,
                "in_progress_courses_count": 3,
            },
        )
        self.enrollment_1.refresh_from_db()
        self.enrollment_2.refresh_from_db()
        self.enrollment_3.refresh_from_db()
        self.enrollment_4.refresh_from_db()
        self.assertEqual(self.enrollment_1.progress_status, "completed")
        self.assertEqual(self.enrollment_2.progress_status, "testing_in_progress")
        self.assertEqual(self.enrollment_3.progress_status, "theory_completed")
        self.assertEqual(self.enrollment_4.progress_status, "enrolled")

    def test_recent_courses_contains_only_user_courses(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["recent_courses"]), 3)
        self.assertEqual(
            [item["course_id"] for item in response.data["recent_courses"]],
            [str(self.course_4.id), str(self.course_3.id), str(self.course_2.id)],
        )
        self.assertNotIn(str(self.other_course.id), {item["course_id"] for item in response.data["recent_courses"]})

    def test_recent_reviews_contains_only_user_reviews(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["recent_reviews"]), 3)
        self.assertEqual(
            [item["review_id"] for item in response.data["recent_reviews"]],
            [str(self.review_4.id), str(self.review_3.id), str(self.review_2.id)],
        )
        self.assertNotIn(str(self.other_review.id), {item["review_id"] for item in response.data["recent_reviews"]})
        self.assertEqual(response.data["recent_reviews"][0]["comment"], "Review 4")
        self.assertEqual(response.data["recent_reviews"][0]["rating"], 4)

    def test_recent_courses_progress_fields_are_returned_correctly(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        recent_courses = {item["course_id"]: item for item in response.data["recent_courses"]}

        self.assertEqual(recent_courses[str(self.course_4.id)]["progress_percent"], 25)
        self.assertEqual(recent_courses[str(self.course_4.id)]["progress_status"], "enrolled")
        self.assertFalse(recent_courses[str(self.course_4.id)]["is_theory_completed"])
        self.assertFalse(recent_courses[str(self.course_4.id)]["is_test_passed"])

        self.assertEqual(recent_courses[str(self.course_3.id)]["progress_percent"], 50)
        self.assertEqual(recent_courses[str(self.course_3.id)]["progress_status"], "theory_completed")
        self.assertTrue(recent_courses[str(self.course_3.id)]["is_theory_completed"])
        self.assertFalse(recent_courses[str(self.course_3.id)]["is_test_passed"])

        self.assertEqual(recent_courses[str(self.course_2.id)]["progress_percent"], 75)
        self.assertEqual(recent_courses[str(self.course_2.id)]["progress_status"], "testing_in_progress")
        self.assertTrue(recent_courses[str(self.course_2.id)]["is_theory_completed"])
        self.assertFalse(recent_courses[str(self.course_2.id)]["is_test_passed"])

    def test_blocked_user_cannot_access_dashboard(self):
        blocked_user = Account.objects.create_user(
            email="blocked-dashboard@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="User",
            status=AccountStatus.BLOCKED,
        )
        refresh = RefreshToken.for_user(blocked_user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")


class AdminUserApiTests(APITestCase):
    def setUp(self):
        self.admin_user = Account.objects.create_user(
            email="admin-users@example.com",
            password="StrongPass123",
            first_name="Admin",
            last_name="Manager",
            role=AccountRole.ADMIN,
            is_staff=True,
        )
        self.regular_user = Account.objects.create_user(
            email="regular-users@example.com",
            password="StrongPass123",
            first_name="Regular",
            last_name="User",
        )
        self.target_user = Account.objects.create_user(
            email="target@example.com",
            password="StrongPass123",
            first_name="Target",
            last_name="Person",
        )
        self.second_target_user = Account.objects.create_user(
            email="second@example.com",
            password="StrongPass123",
            first_name="Second",
            last_name="Member",
            status=AccountStatus.BLOCKED,
        )

        self.list_url = reverse("admin-user-list")

    def authenticate_with_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def get_detail_url(self, user):
        return reverse("admin-user-detail", kwargs={"pk": user.id})

    def test_admin_can_get_user_list(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        self.assertEqual(response.data[0]["user_id"], str(self.second_target_user.id))
        self.assertEqual(response.data[0]["email"], self.second_target_user.email)
        self.assertIn("created_at", response.data[0])
        self.assertIn("updated_at", response.data[0])

    def test_admin_can_filter_user_list(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            self.list_url,
            {"role": AccountRole.USER, "status": AccountStatus.BLOCKED, "search": "second"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user_id"], str(self.second_target_user.id))

    def test_regular_user_cannot_get_user_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_gets_401_for_user_list(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_user_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-admin-users@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Admin",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_admin_can_get_user_detail(self):
        CourseEnrollment.objects.create(
            user=self.target_user,
            course=Course.objects.create(
                title="Admin detail course",
                short_description="Course",
                content="Details",
                status=CourseStatus.AVAILABLE,
            ),
        )
        Review.objects.create(
            user=self.target_user,
            course=Course.objects.create(
                title="Review course",
                short_description="Review",
                content="Review details",
                status=CourseStatus.AVAILABLE,
            ),
            text="Helpful",
            rating=5,
            status=ReviewStatus.APPROVED,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_detail_url(self.target_user))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user_id"], str(self.target_user.id))
        self.assertEqual(response.data["email"], self.target_user.email)
        self.assertEqual(response.data["enrolled_courses_count"], 1)
        self.assertEqual(response.data["reviews_count"], 1)

    def test_nonexistent_user_returns_404(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(reverse("admin-user-detail", kwargs={"pk": "e5ce8bf7-3ad7-4e33-8f57-2c8dce9ced7a"}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_change_user_status(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"status": AccountStatus.BLOCKED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.status, AccountStatus.BLOCKED)
        self.assertEqual(response.data["status"], AccountStatus.BLOCKED)

    def test_admin_can_change_user_role(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"role": AccountRole.ADMIN},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.role, AccountRole.ADMIN)
        self.assertEqual(response.data["role"], AccountRole.ADMIN)

    def test_patch_updates_only_passed_fields(self):
        self.client.force_authenticate(user=self.admin_user)
        original_last_name = self.target_user.last_name
        original_status = self.target_user.status
        original_role = self.target_user.role

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"first_name": "Updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.first_name, "Updated")
        self.assertEqual(self.target_user.last_name, original_last_name)
        self.assertEqual(self.target_user.status, original_status)
        self.assertEqual(self.target_user.role, original_role)

    def test_cannot_change_password_through_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"password": "NewPassword123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.target_user.refresh_from_db()
        self.assertTrue(self.target_user.check_password("StrongPass123"))
        self.assertEqual(response.data["password"][0], "This field cannot be updated.")

    def test_cannot_change_email_through_admin_endpoint(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"email": "new-email@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.email, "target@example.com")
        self.assertEqual(response.data["email"][0], "This field cannot be updated.")

    def test_regular_user_cannot_update_users(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.patch(
            self.get_detail_url(self.target_user),
            {"status": AccountStatus.BLOCKED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.status, AccountStatus.ACTIVE)

    def test_delete_endpoint_is_not_supported_for_users(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_detail_url(self.target_user))

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Account.objects.filter(id=self.target_user.id).exists())

    def test_admin_cannot_block_self(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.admin_user),
            {"status": AccountStatus.BLOCKED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin_user.refresh_from_db()
        self.assertEqual(self.admin_user.status, AccountStatus.ACTIVE)
        self.assertEqual(response.data["status"][0], "You cannot change your own status.")

    def test_admin_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_detail_url(self.admin_user),
            {"role": AccountRole.USER},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin_user.refresh_from_db()
        self.assertEqual(self.admin_user.role, AccountRole.ADMIN)
        self.assertEqual(response.data["role"][0], "You cannot change your own role.")
