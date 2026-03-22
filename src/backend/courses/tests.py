from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountRole, AccountStatus
from courses.models import Course, CourseEnrollment, CourseStatus
from testing.models import CourseTest, TestAttempt


class CoursesApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="student@example.com",
            password="StrongPass123",
            first_name="Student",
            last_name="One",
        )
        self.other_user = Account.objects.create_user(
            email="other-student@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="Student",
        )
        self.available_course = Course.objects.create(
            title="Available course",
            short_description="Short description",
            content="# Markdown",
            status=CourseStatus.AVAILABLE,
        )
        self.unavailable_course = Course.objects.create(
            title="Unavailable course",
            short_description="Not visible in list",
            content="# Hidden",
            status=CourseStatus.UNAVAILABLE,
        )

    def test_get_courses_list(self):
        response = self.client.get(reverse("course-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["course_id"], str(self.available_course.id))
        self.assertNotIn("id", response.data[0])

    def test_get_course_detail(self):
        response = self.client.get(reverse("course-detail", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["course_id"], str(self.available_course.id))
        self.assertIn("content", response.data)
        self.assertEqual(response.data["content"], self.available_course.content)
        self.assertNotIn("description", response.data)
        self.assertNotIn("id", response.data)

    def test_get_unavailable_course_detail_returns_404(self):
        response = self.client.get(reverse("course-detail", kwargs={"pk": self.unavailable_course.id}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_enroll_course(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(reverse("course-enroll", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CourseEnrollment.objects.filter(user=self.user, course=self.available_course).count(), 1)
        enrollment = CourseEnrollment.objects.get(user=self.user, course=self.available_course)
        self.assertEqual(enrollment.progress_status, "enrolled")
        self.assertEqual(response.data["user_id"], str(self.user.id))
        self.assertEqual(response.data["course_id"], str(self.available_course.id))
        self.assertNotIn("id", response.data)

    def test_enroll_unavailable_course_returns_404(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(reverse("course-enroll", kwargs={"pk": self.unavailable_course.id}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_repeat_enroll_course(self):
        self.client.force_authenticate(user=self.user)
        CourseEnrollment.objects.create(user=self.user, course=self.available_course)

        response = self.client.post(reverse("course-enroll", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "User already enrolled")

    def test_get_my_courses_requires_auth(self):
        response = self.client.get(reverse("course-my-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_my_courses_returns_only_current_user_courses_with_progress_fields(self):
        my_enrollment = CourseEnrollment.objects.create(
            user=self.user,
            course=self.available_course,
            is_theory_completed=True,
            progress_status="theory_completed",
        )
        other_enrollment = CourseEnrollment.objects.create(
            user=self.other_user,
            course=self.unavailable_course,
            is_theory_completed=True,
        )
        course_test = CourseTest.objects.create(
            course=self.available_course,
            title="Available course test",
            description="Final test",
            passing_score=1,
            max_attempts=3,
            is_active=True,
        )
        TestAttempt.objects.create(
            user=self.user,
            test=course_test,
            score=1,
            is_passed=True,
            attempt_number=1,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("course-my-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["course_id"], str(self.available_course.id))
        self.assertEqual(response.data[0]["title"], self.available_course.title)
        self.assertEqual(response.data[0]["short_description"], self.available_course.short_description)
        self.assertEqual(response.data[0]["enrolled_at"], my_enrollment.enrolled_at.isoformat().replace("+00:00", "Z"))
        self.assertTrue(response.data[0]["is_theory_completed"])
        self.assertEqual(response.data[0]["progress_percent"], 100)
        self.assertEqual(response.data[0]["progress_status"], "completed")
        self.assertTrue(response.data[0]["is_test_passed"])
        my_enrollment.refresh_from_db()
        self.assertEqual(my_enrollment.progress_status, "theory_completed")
        self.assertFalse(any(item["course_id"] == str(other_enrollment.course_id) for item in response.data))

    def test_get_my_courses_returns_blocked_user_unauthorized(self):
        blocked_user = Account.objects.create_user(
            email="blocked-courses@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Courses",
            status=AccountStatus.BLOCKED,
        )
        CourseEnrollment.objects.create(user=blocked_user, course=self.available_course)
        refresh = RefreshToken.for_user(blocked_user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        response = self.client.get(reverse("course-my-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")



class AdminCoursesApiTests(APITestCase):
    def setUp(self):
        self.admin_user = Account.objects.create_user(
            email="admin@example.com",
            password="StrongPass123",
            first_name="Admin",
            last_name="User",
            role=AccountRole.ADMIN,
            is_staff=True,
        )
        self.regular_user = Account.objects.create_user(
            email="user@example.com",
            password="StrongPass123",
            first_name="Regular",
            last_name="User",
        )
        self.course = Course.objects.create(
            title="Python Basics",
            short_description="Intro course",
            content="Full description",
            status=CourseStatus.AVAILABLE,
        )
        self.second_course = Course.objects.create(
            title="Django Advanced",
            short_description="Advanced course",
            content="Deep dive",
            status=CourseStatus.UNAVAILABLE,
        )

    def authenticate_with_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def get_admin_list_url(self):
        return reverse("admin-course-list-create")

    def get_admin_detail_url(self, course):
        return reverse("admin-course-detail", kwargs={"pk": course.id})

    def test_admin_can_get_course_list(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["course_id"], str(self.second_course.id))
        self.assertEqual(response.data[1]["course_id"], str(self.course.id))
        self.assertEqual(response.data[0]["description"], self.second_course.content)

    def test_regular_user_cannot_get_course_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_gets_401_for_course_list(self):
        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_course_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Admin",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_admin_can_create_course(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_list_url(),
            {
                "title": "New Admin Course",
                "short_description": "Short admin description",
                "description": "Detailed admin description",
                "status": CourseStatus.AVAILABLE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_course = Course.objects.get(title="New Admin Course")
        self.assertEqual(created_course.short_description, "Short admin description")
        self.assertEqual(created_course.content, "Detailed admin description")
        self.assertEqual(created_course.status, CourseStatus.AVAILABLE)
        self.assertEqual(response.data["course_id"], str(created_course.id))
        self.assertEqual(response.data["description"], created_course.content)

    def test_invalid_data_returns_400_on_course_create(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_list_url(),
            {
                "title": "",
                "short_description": "",
                "description": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)
        self.assertIn("short_description", response.data)
        self.assertIn("description", response.data)

    def test_admin_can_get_course_detail(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_detail_url(self.course))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["course_id"], str(self.course.id))
        self.assertEqual(response.data["title"], self.course.title)
        self.assertEqual(response.data["description"], self.course.content)
        self.assertEqual(response.data["status"], self.course.status)

    def test_admin_can_patch_course(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.course),
            {
                "title": "Python Basics Updated",
                "description": "Updated description",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, "Python Basics Updated")
        self.assertEqual(self.course.content, "Updated description")
        self.assertEqual(response.data["title"], self.course.title)
        self.assertEqual(response.data["description"], self.course.content)

    def test_patch_updates_only_passed_fields(self):
        self.client.force_authenticate(user=self.admin_user)
        original_short_description = self.course.short_description
        original_status = self.course.status

        response = self.client.patch(
            self.get_admin_detail_url(self.course),
            {"title": "Only Title Changed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, "Only Title Changed")
        self.assertEqual(self.course.short_description, original_short_description)
        self.assertEqual(self.course.status, original_status)
        self.assertEqual(self.course.content, "Full description")

    def test_nonexistent_course_returns_404(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(reverse("admin-course-detail", kwargs={"pk": "e5ce8bf7-3ad7-4e33-8f57-2c8dce9ced7a"}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_change_course_status(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.course),
            {"status": CourseStatus.UNAVAILABLE},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.status, CourseStatus.UNAVAILABLE)
        self.assertEqual(response.data["status"], CourseStatus.UNAVAILABLE)

    def test_course_status_change_is_persisted_and_hides_course_from_public_api(self):
        self.client.force_authenticate(user=self.admin_user)

        patch_response = self.client.patch(
            self.get_admin_detail_url(self.course),
            {"status": CourseStatus.UNAVAILABLE},
            format="json",
        )
        self.client.force_authenticate(user=None)
        list_response = self.client.get(reverse("course-list"))

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.status, CourseStatus.UNAVAILABLE)
        self.assertEqual(len(list_response.data), 0)

    def test_regular_user_cannot_patch_course(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.course),
            {"status": CourseStatus.UNAVAILABLE},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.course.refresh_from_db()
        self.assertEqual(self.course.status, CourseStatus.AVAILABLE)

    def test_delete_endpoint_is_not_supported(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_detail_url(self.course))

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Course.objects.filter(id=self.course.id).exists())
