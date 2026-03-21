from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from courses.models import Course, CourseEnrollment, CourseStatus
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion


class TestingApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="tester@example.com",
            password="StrongPass123",
            first_name="Test",
            last_name="User",
        )
        self.other_user = Account.objects.create_user(
            email="other@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="User",
        )
        self.course = Course.objects.create(
            title="Python course",
            short_description="desc",
            content="# content",
            status=CourseStatus.AVAILABLE,
        )
        self.enrollment = CourseEnrollment.objects.create(
            user=self.user,
            course=self.course,
            is_theory_completed=True,
        )
        self.test = CourseTest.objects.create(
            course=self.course,
            title="Final test",
            description="Course final test",
            passing_score=1,
            max_attempts=1,
            is_active=True,
        )
        self.question = TestQuestion.objects.create(
            test=self.test,
            text="2 + 2 = ?",
            order=1,
        )
        self.correct_option = AnswerOption.objects.create(
            question=self.question,
            text="4",
            is_correct=True,
        )
        self.wrong_option = AnswerOption.objects.create(
            question=self.question,
            text="5",
            is_correct=False,
        )

    def test_get_course_test_info(self):
        response = self.client.get(reverse("course-test-info", kwargs={"course_id": self.course.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_test"])
        self.assertEqual(response.data["title"], self.test.title)

    def test_submit_test_success(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                }
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["score"], 1)
        self.assertTrue(response.data["is_passed"])
        self.assertEqual(response.data["attempt_number"], 1)
        self.assertEqual(response.data["remaining_attempts"], 0)

    def test_submit_requires_auth(self):
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                }
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_submit_denied_when_max_attempts_exceeded(self):
        self.client.force_authenticate(user=self.user)
        TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            score=1,
            is_passed=True,
            attempt_number=1,
        )
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                }
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data[0], "Max attempts exceeded")

    def test_get_attempt_history_for_current_user(self):
        TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            score=1,
            is_passed=True,
            attempt_number=1,
        )
        TestAttempt.objects.create(
            user=self.other_user,
            test=self.test,
            score=0,
            is_passed=False,
            attempt_number=1,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("test-attempts", kwargs={"test_id": self.test.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["attempt_number"], 1)

    def test_submit_denied_without_enrollment(self):
        self.client.force_authenticate(user=self.other_user)
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                }
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "User is not enrolled in this course.")

    def test_submit_denied_without_completed_theory(self):
        self.client.force_authenticate(user=self.user)
        self.enrollment.is_theory_completed = False
        self.enrollment.save(update_fields=("is_theory_completed",))
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                }
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Theory must be completed before testing")
