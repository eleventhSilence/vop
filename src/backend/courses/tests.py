from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from courses.models import Course, CourseEnrollment, CourseStatus


class CoursesApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="student@example.com",
            password="StrongPass123",
            first_name="Student",
            last_name="One",
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

    def test_enroll_course(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(reverse("course-enroll", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CourseEnrollment.objects.filter(user=self.user, course=self.available_course).count(), 1)

    def test_repeat_enroll_course(self):
        self.client.force_authenticate(user=self.user)
        CourseEnrollment.objects.create(user=self.user, course=self.available_course)

        response = self.client.post(reverse("course-enroll", kwargs={"pk": self.available_course.id}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "User already enrolled")
