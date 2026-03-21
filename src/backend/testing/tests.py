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
        self.unavailable_course = Course.objects.create(
            title="Hidden Python course",
            short_description="hidden desc",
            content="# hidden content",
            status=CourseStatus.UNAVAILABLE,
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
            passing_score=2,
            max_attempts=1,
            is_active=True,
        )
        self.question = TestQuestion.objects.create(
            test=self.test,
            text="2 + 2 = ?",
            order=1,
        )
        self.second_question = TestQuestion.objects.create(
            test=self.test,
            text="3 + 3 = ?",
            order=2,
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
        self.second_correct_option = AnswerOption.objects.create(
            question=self.second_question,
            text="6",
            is_correct=True,
        )
        self.foreign_question = TestQuestion.objects.create(
            test=CourseTest.objects.create(
                course=self.unavailable_course,
                title="Foreign test",
                description="Foreign",
                passing_score=1,
                max_attempts=1,
                is_active=True,
            ),
            text="foreign",
            order=1,
        )
        self.foreign_option = AnswerOption.objects.create(
            question=self.foreign_question,
            text="foreign option",
            is_correct=True,
        )

    def test_get_course_test_info(self):
        response = self.client.get(reverse("course-test-info", kwargs={"course_id": self.course.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_test"])
        self.assertEqual(response.data["title"], self.test.title)

    def test_get_course_test_info_returns_404_for_unavailable_course(self):
        response = self.client.get(reverse("course-test-info", kwargs={"course_id": self.unavailable_course.id}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_submit_test_success(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                },
                {
                    "question": str(self.second_question.id),
                    "selected_option": str(self.second_correct_option.id),
                },
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["score"], 2)
        self.assertTrue(response.data["is_passed"])
        self.assertEqual(response.data["attempt_number"], 1)
        self.assertEqual(response.data["remaining_attempts"], 0)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "completed")

    def test_submit_requires_auth(self):
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                },
                {
                    "question": str(self.second_question.id),
                    "selected_option": str(self.second_correct_option.id),
                },
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_submit_rejects_empty_answers(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {"answers": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("answers", response.data)

    def test_submit_rejects_partial_answers(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question": str(self.question.id),
                        "selected_option": str(self.correct_option.id),
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data[0], "All test questions must be answered")

    def test_submit_preserves_duplicate_question_validation(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question": str(self.question.id),
                        "selected_option": str(self.correct_option.id),
                    },
                    {
                        "question": str(self.question.id),
                        "selected_option": str(self.wrong_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data[0], "Duplicate answers for the same question")

    def test_submit_preserves_question_and_option_belonging_validation(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question": str(self.question.id),
                        "selected_option": str(self.correct_option.id),
                    },
                    {
                        "question": str(self.second_question.id),
                        "selected_option": str(self.foreign_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data[0], "Selected option does not belong to question")

    def test_submit_denied_when_max_attempts_exceeded(self):
        self.client.force_authenticate(user=self.user)
        TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            score=2,
            is_passed=True,
            attempt_number=1,
        )
        payload = {
            "answers": [
                {
                    "question": str(self.question.id),
                    "selected_option": str(self.correct_option.id),
                },
                {
                    "question": str(self.second_question.id),
                    "selected_option": str(self.second_correct_option.id),
                },
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
            score=2,
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
                },
                {
                    "question": str(self.second_question.id),
                    "selected_option": str(self.second_correct_option.id),
                },
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
                },
                {
                    "question": str(self.second_question.id),
                    "selected_option": str(self.second_correct_option.id),
                },
            ]
        }

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Theory must be completed before testing")
