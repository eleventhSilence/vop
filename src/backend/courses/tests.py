from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountStatus
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
        self.assertEqual(response.data[0]["id"], str(self.available_course.id))

    def test_get_course_detail(self):
        response = self.client.get(reverse("course-detail", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.available_course.id))
        self.assertIn("content", response.data)

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
