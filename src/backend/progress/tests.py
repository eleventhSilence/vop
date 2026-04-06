from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
from courses.models import Course, CourseEnrollment, CourseStatus
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion


class ProgressApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="progress@example.com",
            password="StrongPass123",
            first_name="Progress",
            last_name="User",
        )
        self.other_user = Account.objects.create_user(
            email="other-progress@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="User",
        )
        self.course = Course.objects.create(
            title="Algorithms",
            short_description="Algorithms basics",
            content="# algorithms",
            status=CourseStatus.AVAILABLE,
        )
        self.second_course = Course.objects.create(
            title="Databases",
            short_description="DB basics",
            content="# databases",
            status=CourseStatus.AVAILABLE,
        )
        self.enrollment = CourseEnrollment.objects.create(user=self.user, course=self.course)
        self.second_enrollment = CourseEnrollment.objects.create(
            user=self.user,
            course=self.second_course,
            is_theory_completed=True,
        )
        self.test = CourseTest.objects.create(
            course=self.course,
            title="Algorithms test",
            description="Final algorithms test",
            passing_score=2,
            max_attempts=3,
            is_active=True,
        )
        self.question = TestQuestion.objects.create(test=self.test, text="1 + 1 = ?", order=1)
        self.correct_option = AnswerOption.objects.create(
            question=self.question, text="2", is_correct=True, order=1
        )
        self.wrong_option = AnswerOption.objects.create(
            question=self.question, text="3", is_correct=False, order=2
        )

    def test_complete_theory_success(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("progress-complete-theory", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.enrollment.refresh_from_db()
        self.assertTrue(self.enrollment.is_theory_completed)
        self.assertIsNotNone(self.enrollment.theory_completed_at)
        self.assertEqual(self.enrollment.progress_status, "enrolled")
        self.assertEqual(response.data["progress_percent"], 50)
        self.assertEqual(response.data["progress_status"], "theory_completed")

    def test_complete_theory_requires_auth(self):
        response = self.client.post(
            reverse("progress-complete-theory", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_complete_theory_requires_enrollment(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            reverse("progress-complete-theory", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_my_progress_list_uses_computed_progress_status(self):
        self.client.force_authenticate(user=self.user)
        self.second_enrollment.progress_status = "completed"
        self.second_enrollment.save(update_fields=("progress_status",))

        response = self.client.get(reverse("progress-my-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["course_id"], str(self.second_course.id))
        self.assertEqual(response.data["results"][1]["course_id"], str(self.course.id))
        self.assertEqual(
            {item["course_id"] for item in response.data["results"]},
            {str(self.course.id), str(self.second_course.id)},
        )
        second_course_payload = next(
            item for item in response.data["results"] if item["course_id"] == str(self.second_course.id)
        )
        self.second_enrollment.refresh_from_db()
        self.assertEqual(self.second_enrollment.progress_status, "completed")
        self.assertEqual(second_course_payload["progress_percent"], 50)
        self.assertEqual(second_course_payload["progress_status"], "theory_completed")

    def test_get_course_progress_detail(self):
        self.client.force_authenticate(user=self.user)
        TestAttempt.objects.create(user=self.user, test=self.test, score=1, is_passed=False, attempt_number=1)

        response = self.client.get(
            reverse("progress-course-detail", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["course_id"], str(self.course.id))
        self.assertEqual(response.data["total_attempts"], 1)
        self.assertEqual(len(response.data["attempts"]), 1)
        self.assertIn("attempt_id", response.data["attempts"][0])

    def test_progress_is_25_when_theory_not_completed(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("progress-course-detail", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "enrolled")
        self.assertEqual(response.data["progress_percent"], 25)
        self.assertEqual(response.data["progress_status"], "enrolled")

    def test_progress_is_50_when_theory_completed(self):
        self.client.force_authenticate(user=self.user)
        self.enrollment.is_theory_completed = True
        self.enrollment.progress_status = "enrolled"
        self.enrollment.save(update_fields=("is_theory_completed", "progress_status"))

        response = self.client.get(
            reverse("progress-course-detail", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "enrolled")
        self.assertEqual(response.data["progress_percent"], 50)
        self.assertEqual(response.data["progress_status"], "theory_completed")

    def test_progress_is_75_when_testing_started(self):
        self.client.force_authenticate(user=self.user)
        self.enrollment.is_theory_completed = True
        self.enrollment.progress_status = "theory_completed"
        self.enrollment.save(update_fields=("is_theory_completed", "progress_status"))
        TestAttempt.objects.create(user=self.user, test=self.test, score=1, is_passed=False, attempt_number=1)

        response = self.client.get(
            reverse("progress-course-detail", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "theory_completed")
        self.assertEqual(response.data["progress_percent"], 75)
        self.assertEqual(response.data["progress_status"], "testing_in_progress")

    def test_progress_is_100_when_test_passed(self):
        self.client.force_authenticate(user=self.user)
        self.enrollment.is_theory_completed = True
        self.enrollment.progress_status = "testing_in_progress"
        self.enrollment.save(update_fields=("is_theory_completed", "progress_status"))
        TestAttempt.objects.create(user=self.user, test=self.test, score=2, is_passed=True, attempt_number=1)

        response = self.client.get(
            reverse("progress-course-detail", kwargs={"course_id": self.course.id}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "testing_in_progress")
        self.assertEqual(response.data["progress_percent"], 100)
        self.assertEqual(response.data["progress_status"], "completed")
