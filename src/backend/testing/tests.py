from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountRole, AccountStatus
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


class AdminTestingApiTests(APITestCase):
    def setUp(self):
        self.admin_user = Account.objects.create_user(
            email="admin-testing@example.com",
            password="StrongPass123",
            first_name="Admin",
            last_name="Testing",
            role=AccountRole.ADMIN,
            is_staff=True,
        )
        self.regular_user = Account.objects.create_user(
            email="regular-testing@example.com",
            password="StrongPass123",
            first_name="Regular",
            last_name="Testing",
        )
        self.course = Course.objects.create(
            title="Admin Python course",
            short_description="Short admin description",
            content="# admin content",
            status=CourseStatus.AVAILABLE,
        )
        self.second_course = Course.objects.create(
            title="Admin Django course",
            short_description="Second admin description",
            content="# second content",
            status=CourseStatus.UNAVAILABLE,
        )
        self.test = CourseTest.objects.create(
            course=self.course,
            title="Admin final test",
            description="Admin managed test",
            passing_score=2,
            max_attempts=3,
            is_active=True,
        )

    def authenticate_with_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def get_admin_list_url(self):
        return reverse("admin-test-list-create")

    def get_admin_detail_url(self, test):
        return reverse("admin-test-detail", kwargs={"pk": test.id})

    def test_admin_can_get_test_list(self):
        second_test = CourseTest.objects.create(
            course=self.second_course,
            title="Second admin test",
            description="Second test description",
            passing_score=1,
            max_attempts=2,
            is_active=False,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["test_id"], str(second_test.id))
        self.assertEqual(response.data[0]["course_id"], str(self.second_course.id))
        self.assertEqual(response.data[0]["course_title"], self.second_course.title)
        self.assertEqual(response.data[1]["test_id"], str(self.test.id))

    def test_regular_user_cannot_get_test_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_gets_401_for_test_list(self):
        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_test_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-testing-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Testing",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_admin_can_create_test(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_list_url(),
            {
                "course_id": str(self.second_course.id),
                "title": "Created admin test",
                "description": "Created by admin endpoint",
                "passing_score": 4,
                "max_attempts": 5,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_test = CourseTest.objects.get(title="Created admin test")
        self.assertEqual(created_test.course, self.second_course)
        self.assertEqual(response.data["test_id"], str(created_test.id))
        self.assertEqual(response.data["course_id"], str(self.second_course.id))
        self.assertEqual(response.data["course_title"], self.second_course.title)

    def test_invalid_data_returns_400_on_test_create(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_list_url(),
            {
                "course_id": str(self.second_course.id),
                "title": "",
                "description": "Created by admin endpoint",
                "passing_score": 0,
                "max_attempts": 0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)
        self.assertIn("passing_score", response.data)
        self.assertIn("max_attempts", response.data)

    def test_cannot_create_test_for_nonexistent_course(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_list_url(),
            {
                "course_id": "da4ec6f5-b4ca-42da-bef0-df7dd5918eb5",
                "title": "Ghost course test",
                "description": "Should fail",
                "passing_score": 1,
                "max_attempts": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("course_id", response.data)

    def test_admin_can_get_specific_test(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["test_id"], str(self.test.id))
        self.assertEqual(response.data["course_id"], str(self.course.id))
        self.assertEqual(response.data["title"], self.test.title)

    def test_admin_can_patch_test(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.test),
            {
                "title": "Updated admin test",
                "description": "Updated description",
                "passing_score": 3,
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.test.refresh_from_db()
        self.assertEqual(self.test.title, "Updated admin test")
        self.assertEqual(self.test.description, "Updated description")
        self.assertEqual(self.test.passing_score, 3)
        self.assertFalse(self.test.is_active)

    def test_patch_updates_only_passed_fields(self):
        self.client.force_authenticate(user=self.admin_user)
        original_description = self.test.description
        original_max_attempts = self.test.max_attempts
        original_is_active = self.test.is_active

        response = self.client.patch(
            self.get_admin_detail_url(self.test),
            {"title": "Only title updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.test.refresh_from_db()
        self.assertEqual(self.test.title, "Only title updated")
        self.assertEqual(self.test.description, original_description)
        self.assertEqual(self.test.max_attempts, original_max_attempts)
        self.assertEqual(self.test.is_active, original_is_active)

    def test_nonexistent_test_returns_404(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(reverse("admin-test-detail", kwargs={"pk": "d9816d64-20e4-4190-8fa1-7924a35d8426"}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_delete_test_without_attempts_and_questions(self):
        deletable_test = CourseTest.objects.create(
            course=self.second_course,
            title="Deletable test",
            description="Can be deleted",
            passing_score=1,
            max_attempts=1,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_detail_url(deletable_test))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CourseTest.objects.filter(id=deletable_test.id).exists())

    def test_cannot_delete_test_with_attempts(self):
        TestAttempt.objects.create(
            user=self.regular_user,
            test=self.test,
            score=2,
            is_passed=True,
            attempt_number=1,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Test cannot be deleted because it already has attempts.")
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())

    def test_cannot_delete_test_with_questions(self):
        question = TestQuestion.objects.create(
            test=self.test,
            text="Question blocks deletion",
            order=1,
        )
        AnswerOption.objects.create(
            question=question,
            text="Option",
            is_correct=True,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Test cannot be deleted because it still has questions. Delete questions first.",
        )
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())

    def test_regular_user_cannot_delete_test(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.delete(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())

    def test_unauthorized_user_gets_401_for_test_delete(self):
        response = self.client.delete(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())

    def test_blocked_admin_cannot_delete_test(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-delete-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Delete",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.delete(self.get_admin_detail_url(self.test))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())
