from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountRole, AccountStatus
from courses.models import Course, CourseEnrollment, CourseStatus
from testing.models import AnswerOption, CourseTest, TestAttempt, TestQuestion, UserAnswer


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
        self.assertEqual(response.data["test_id"], str(self.test.id))
        self.assertEqual(len(response.data["questions"]), 2)
        self.assertEqual(response.data["questions"][0]["question_type"], TestQuestion.QuestionType.SINGLE_CHOICE)
        self.assertNotIn("is_correct", response.data["questions"][0]["options"][0])

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
        self.assertIn("attempt_id", response.data)
        self.assertEqual(response.data["attempt_number"], 1)
        self.assertEqual(response.data["remaining_attempts"], 0)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress_status, "enrolled")

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
        self.assertEqual(response.data["answers"], "All test questions must be answered.")

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
        self.assertEqual(response.data["answers"], "Duplicate answers for the same question.")

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
        self.assertEqual(response.data["selected_option_id"], "Selected option does not belong to question.")

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
        self.assertEqual(response.data["detail"], "Max attempts exceeded.")

    def test_get_attempt_history_for_current_user(self):
        first_attempt = TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            score=2,
            is_passed=True,
            attempt_number=1,
        )
        second_attempt = TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            score=1,
            is_passed=False,
            attempt_number=2,
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
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["attempt_id"], str(second_attempt.id))
        self.assertEqual(response.data["results"][0]["attempt_number"], 2)
        self.assertEqual(response.data["results"][1]["attempt_id"], str(first_attempt.id))
        self.assertEqual(response.data["results"][1]["attempt_number"], 1)

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

    def test_submit_multiple_choice_success(self):
        self.client.force_authenticate(user=self.user)
        self.question.question_type = TestQuestion.QuestionType.MULTIPLE_CHOICE
        self.question.save(update_fields=("question_type",))
        second_correct_option = AnswerOption.objects.create(
            question=self.question,
            text="Also 4",
            is_correct=True,
        )

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question_id": str(self.question.id),
                        "selected_option_ids": [str(self.correct_option.id), str(second_correct_option.id)],
                    },
                    {
                        "question_id": str(self.second_question.id),
                        "selected_option_id": str(self.second_correct_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("attempt_id", response.data)
        self.assertEqual(response.data["score"], 2)
        self.assertEqual(UserAnswer.objects.filter(attempt__test=self.test, question=self.question).count(), 2)

    def test_submit_multiple_choice_partial_match_is_incorrect(self):
        self.client.force_authenticate(user=self.user)
        self.question.question_type = TestQuestion.QuestionType.MULTIPLE_CHOICE
        self.question.save(update_fields=("question_type",))
        second_correct_option = AnswerOption.objects.create(
            question=self.question,
            text="Also 4",
            is_correct=True,
        )

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question_id": str(self.question.id),
                        "selected_option_ids": [str(self.correct_option.id)],
                    },
                    {
                        "question_id": str(self.second_question.id),
                        "selected_option_id": str(self.second_correct_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["score"], 1)
        self.assertFalse(response.data["is_passed"])

    def test_submit_rejects_wrong_payload_for_multiple_choice_question(self):
        self.client.force_authenticate(user=self.user)
        self.question.question_type = TestQuestion.QuestionType.MULTIPLE_CHOICE
        self.question.save(update_fields=("question_type",))
        second_correct_option = AnswerOption.objects.create(
            question=self.question,
            text="Also 4",
            is_correct=True,
        )

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question_id": str(self.question.id),
                        "selected_option_id": str(self.correct_option.id),
                    },
                    {
                        "question_id": str(self.second_question.id),
                        "selected_option_id": str(self.second_correct_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["selected_option_ids"], "Multiple choice question expects selected_option_ids.")

    def test_submit_rejects_wrong_payload_for_single_choice_question(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("test-submit", kwargs={"test_id": self.test.id}),
            {
                "answers": [
                    {
                        "question_id": str(self.question.id),
                        "selected_option_ids": [str(self.correct_option.id)],
                    },
                    {
                        "question_id": str(self.second_question.id),
                        "selected_option_id": str(self.second_correct_option.id),
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["selected_option_id"], "Single choice question expects selected_option_id.")

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
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["test_id"], str(second_test.id))
        self.assertEqual(response.data["results"][0]["course_id"], str(self.second_course.id))
        self.assertEqual(response.data["results"][0]["course_title"], self.second_course.title)
        self.assertEqual(response.data["results"][1]["test_id"], str(self.test.id))

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

    def get_admin_question_list_url(self):
        return reverse("admin-question-list-create")

    def get_admin_question_detail_url(self, question):
        return reverse("admin-question-detail", kwargs={"pk": question.id})

    def create_question(self, **kwargs):
        payload = {
            "test": self.test,
            "text": "Question text",
            "order": 1,
        }
        payload.update(kwargs)
        return TestQuestion.objects.create(**payload)

    def test_admin_can_get_question_list(self):
        first_question = self.create_question(text="First admin question", order=1)
        second_question = self.create_question(text="Second admin question", order=2)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_question_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["question_id"], str(first_question.id))
        self.assertEqual(response.data["results"][0]["test_id"], str(self.test.id))
        self.assertEqual(response.data["results"][0]["test_title"], self.test.title)
        self.assertEqual(response.data["results"][1]["question_id"], str(second_question.id))

    def test_regular_user_cannot_get_question_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_question_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_gets_401_for_question_list(self):
        response = self.client.get(self.get_admin_question_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_question_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-question-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Question",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.get_admin_question_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_admin_can_create_question(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_question_list_url(),
            {
                "test_id": str(self.test.id),
                "text": "Created admin question",
                "order": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_question = TestQuestion.objects.get(text="Created admin question")
        self.assertEqual(created_question.test, self.test)
        self.assertEqual(response.data["question_id"], str(created_question.id))
        self.assertEqual(response.data["test_id"], str(self.test.id))
        self.assertEqual(response.data["test_title"], self.test.title)
        self.assertEqual(response.data["question_type"], TestQuestion.QuestionType.SINGLE_CHOICE)

    def test_admin_can_create_multiple_choice_question(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_question_list_url(),
            {
                "test_id": str(self.test.id),
                "text": "Select all correct answers",
                "order": 1,
                "question_type": TestQuestion.QuestionType.MULTIPLE_CHOICE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["question_type"], TestQuestion.QuestionType.MULTIPLE_CHOICE)

    def test_invalid_data_returns_400_on_question_create(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_question_list_url(),
            {
                "test_id": str(self.test.id),
                "text": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("text", response.data)
        self.assertIn("order", response.data)

    def test_cannot_create_question_for_nonexistent_test(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_question_list_url(),
            {
                "test_id": "da4ec6f5-b4ca-42da-bef0-df7dd5918eb5",
                "text": "Ghost question",
                "order": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("test_id", response.data)

    def test_admin_can_get_specific_question(self):
        question = self.create_question(text="Specific question", order=1)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_question_detail_url(question))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["question_id"], str(question.id))
        self.assertEqual(response.data["test_id"], str(self.test.id))
        self.assertEqual(response.data["text"], question.text)

    def test_admin_can_patch_question(self):
        question = self.create_question(text="Original question", order=1)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_question_detail_url(question),
            {
                "text": "Updated question",
                "order": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertEqual(question.text, "Updated question")
        self.assertEqual(question.order, 2)

    def test_question_patch_updates_only_passed_fields(self):
        question = self.create_question(text="Partial question", order=1)
        original_order = question.order
        original_test_id = question.test_id
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_question_detail_url(question),
            {"text": "Only text updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertEqual(question.text, "Only text updated")
        self.assertEqual(question.order, original_order)
        self.assertEqual(question.test_id, original_test_id)

    def test_nonexistent_question_returns_404(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(reverse("admin-question-detail", kwargs={"pk": "d9816d64-20e4-4190-8fa1-7924a35d8426"}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_delete_question_without_answer_options(self):
        question = self.create_question(text="Delete me", order=1)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_question_detail_url(question))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TestQuestion.objects.filter(id=question.id).exists())

    def test_cannot_delete_question_with_answer_options(self):
        question = self.create_question(text="Protected question", order=1)
        AnswerOption.objects.create(
            question=question,
            text="Option blocks deletion",
            is_correct=True,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_question_detail_url(question))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Question cannot be deleted because it still has answer options. Delete answer options first.",
        )
        self.assertTrue(TestQuestion.objects.filter(id=question.id).exists())

    def test_regular_user_cannot_delete_question(self):
        question = self.create_question(text="Regular cannot delete", order=1)
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.delete(self.get_admin_question_detail_url(question))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TestQuestion.objects.filter(id=question.id).exists())


    def get_admin_answer_option_list_url(self):
        return reverse("admin-answer-option-list-create")

    def get_admin_answer_option_detail_url(self, option):
        return reverse("admin-answer-option-detail", kwargs={"pk": option.id})

    def create_answer_option(self, **kwargs):
        payload = {
            "question": TestQuestion.objects.create(
                test=self.test,
                text="Answer option question",
                order=kwargs.pop("question_order", 1),
            ),
            "text": "Answer option text",
            "is_correct": False,
        }
        payload.update(kwargs)
        return AnswerOption.objects.create(**payload)

    def test_admin_can_get_answer_option_list(self):
        first_question = self.create_question(text="Question for first option", order=1)
        second_question = self.create_question(text="Question for second option", order=2)
        first_option = AnswerOption.objects.create(question=first_question, text="Option A", is_correct=True)
        second_option = AnswerOption.objects.create(question=second_question, text="Option B", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_answer_option_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["option_id"], str(first_option.id))
        self.assertEqual(response.data["results"][0]["question_id"], str(first_question.id))
        self.assertEqual(response.data["results"][0]["question_text"], first_question.text)
        self.assertIn("created_at", response.data["results"][0])
        self.assertIn("updated_at", response.data["results"][0])
        self.assertEqual(response.data["results"][1]["option_id"], str(second_option.id))

    def test_regular_user_cannot_get_answer_option_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_answer_option_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_gets_401_for_answer_option_list(self):
        response = self.client.get(self.get_admin_answer_option_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_answer_option_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-answer-option-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Option",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.get_admin_answer_option_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_admin_can_create_answer_option(self):
        question = self.create_question(text="Question for create option", order=1)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": str(question.id),
                "text": "Created answer option",
                "is_correct": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_option = AnswerOption.objects.get(text="Created answer option")
        self.assertEqual(created_option.question, question)
        self.assertEqual(response.data["option_id"], str(created_option.id))
        self.assertEqual(response.data["question_id"], str(question.id))
        self.assertEqual(response.data["question_text"], question.text)
        self.assertTrue(response.data["is_correct"])

    def test_invalid_data_returns_400_on_answer_option_create(self):
        question = self.create_question(text="Question for invalid create", order=1)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": str(question.id),
                "text": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("text", response.data)

    def test_cannot_create_answer_option_for_nonexistent_question(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": "da4ec6f5-b4ca-42da-bef0-df7dd5918eb5",
                "text": "Ghost answer option",
                "is_correct": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("question_id", response.data)

    def test_admin_can_get_specific_answer_option(self):
        question = self.create_question(text="Specific option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Specific option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_answer_option_detail_url(option))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["option_id"], str(option.id))
        self.assertEqual(response.data["question_id"], str(question.id))
        self.assertEqual(response.data["text"], option.text)

    def test_single_choice_question_cannot_have_multiple_correct_answers(self):
        question = self.create_question(text="Single choice question", order=1)
        AnswerOption.objects.create(question=question, text="Correct A", is_correct=True)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": str(question.id),
                "text": "Correct B",
                "is_correct": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["is_correct"][0], "Single choice question must have exactly one correct answer")

    def test_invalid_answer_option_create_does_not_persist_object(self):
        question = self.create_question(text="Atomic create question", order=1)
        AnswerOption.objects.create(question=question, text="Correct A", is_correct=True)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": str(question.id),
                "text": "Should not persist",
                "is_correct": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AnswerOption.objects.filter(question=question, text="Should not persist").exists())
        self.assertEqual(question.answer_options.filter(is_correct=True).count(), 1)

    def test_multiple_choice_question_must_have_correct_answer(self):
        question = self.create_question(
            text="Multiple choice question",
            order=1,
            question_type=TestQuestion.QuestionType.MULTIPLE_CHOICE,
        )
        AnswerOption.objects.create(question=question, text="Incorrect", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            self.get_admin_answer_option_list_url(),
            {
                "question_id": str(question.id),
                "text": "Still incorrect",
                "is_correct": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["is_correct"][0], "Multiple choice question must have at least one correct answer")

    def test_admin_can_patch_answer_option(self):
        question = self.create_question(text="Original option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Original option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_answer_option_detail_url(option),
            {
                "text": "Updated answer option",
                "is_correct": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        option.refresh_from_db()
        self.assertEqual(option.text, "Updated answer option")
        self.assertTrue(option.is_correct)

    def test_invalid_answer_option_update_does_not_persist_changes(self):
        question = self.create_question(text="Atomic update question", order=1)
        correct_option = AnswerOption.objects.create(question=question, text="Correct option", is_correct=True)
        option = AnswerOption.objects.create(question=question, text="Wrong option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_answer_option_detail_url(option),
            {
                "text": "Should rollback",
                "is_correct": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        option.refresh_from_db()
        correct_option.refresh_from_db()
        self.assertEqual(option.text, "Wrong option")
        self.assertFalse(option.is_correct)
        self.assertEqual(question.answer_options.filter(is_correct=True).count(), 1)
        self.assertEqual(correct_option.text, "Correct option")

    def test_answer_option_patch_updates_only_passed_fields(self):
        first_question = self.create_question(text="First patch option question", order=1)
        second_question = self.create_question(text="Second patch option question", order=2)
        option = AnswerOption.objects.create(question=first_question, text="Patch option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_answer_option_detail_url(option),
            {"text": "Only option text updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        option.refresh_from_db()
        self.assertEqual(option.text, "Only option text updated")
        self.assertFalse(option.is_correct)
        self.assertEqual(option.question_id, first_question.id)
        self.assertNotEqual(option.question_id, second_question.id)

    def test_nonexistent_answer_option_returns_404(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            reverse("admin-answer-option-detail", kwargs={"pk": "d9816d64-20e4-4190-8fa1-7924a35d8426"})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_delete_answer_option(self):
        question = self.create_question(text="Delete option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Delete option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_answer_option_detail_url(option))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AnswerOption.objects.filter(id=option.id).exists())
        self.assertTrue(TestQuestion.objects.filter(id=question.id).exists())
        self.assertTrue(CourseTest.objects.filter(id=self.test.id).exists())

    def test_invalid_answer_option_delete_does_not_remove_object(self):
        question = self.create_question(
            text="Atomic delete question",
            order=1,
            question_type=TestQuestion.QuestionType.MULTIPLE_CHOICE,
        )
        correct_option = AnswerOption.objects.create(question=question, text="Correct option", is_correct=True)
        AnswerOption.objects.create(question=question, text="Wrong option", is_correct=False)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(self.get_admin_answer_option_detail_url(correct_option))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AnswerOption.objects.filter(id=correct_option.id).exists())
        self.assertEqual(question.answer_options.filter(is_correct=True).count(), 1)

    def test_regular_user_cannot_delete_answer_option(self):
        question = self.create_question(text="Regular delete option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Protected option", is_correct=False)
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.delete(self.get_admin_answer_option_detail_url(option))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(AnswerOption.objects.filter(id=option.id).exists())

    def test_unauthorized_user_gets_401_for_answer_option_delete(self):
        question = self.create_question(text="Unauthorized delete option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Unauthorized protected option", is_correct=False)

        response = self.client.delete(self.get_admin_answer_option_detail_url(option))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(AnswerOption.objects.filter(id=option.id).exists())

    def test_blocked_admin_cannot_delete_answer_option(self):
        question = self.create_question(text="Blocked delete option question", order=1)
        option = AnswerOption.objects.create(question=question, text="Blocked protected option", is_correct=False)
        blocked_admin = Account.objects.create_user(
            email="blocked-delete-answer-option@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="DeleteOption",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.delete(self.get_admin_answer_option_detail_url(option))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")
        self.assertTrue(AnswerOption.objects.filter(id=option.id).exists())
