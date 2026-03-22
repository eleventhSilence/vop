from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Account, AccountRole, AccountStatus
from courses.models import Course, CourseEnrollment, CourseStatus
from reviews.models import Review, ReviewStatus


class ReviewsApiTests(APITestCase):
    def setUp(self):
        self.user = Account.objects.create_user(
            email="reviewer@example.com",
            password="StrongPass123",
            first_name="Review",
            last_name="User",
        )
        self.other_user = Account.objects.create_user(
            email="other-reviewer@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="User",
        )
        self.course = Course.objects.create(
            title="Django course",
            short_description="desc",
            content="# content",
            status=CourseStatus.AVAILABLE,
        )
        self.second_course = Course.objects.create(
            title="Python course",
            short_description="desc 2",
            content="# content 2",
            status=CourseStatus.AVAILABLE,
        )
        CourseEnrollment.objects.create(user=self.user, course=self.course)

    def authenticate_with_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def get_update_url(self, review):
        return reverse("review-update", kwargs={"pk": review.id})

    def create_review(self, **kwargs):
        defaults = {
            "user": self.user,
            "course": self.course,
            "text": "Первый отзыв",
            "rating": 4,
            "status": ReviewStatus.PENDING,
        }
        defaults.update(kwargs)
        return Review.objects.create(**defaults)

    def test_create_review_authorized_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Очень полезный курс", "rating": 1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = Review.objects.get(user=self.user, course=self.course)
        self.assertEqual(review.status, ReviewStatus.PENDING)
        self.assertEqual(review.text, "Очень полезный курс")
        self.assertEqual(review.rating, 1)
        self.assertEqual(response.data["review_id"], str(review.id))
        self.assertEqual(str(response.data["course_id"]), str(self.course.id))
        self.assertEqual(response.data["comment"], review.text)
        self.assertNotIn("text", response.data)

    def test_create_review_accepts_max_rating_value(self):
        CourseEnrollment.objects.create(user=self.user, course=self.second_course)
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.second_course.id), "text": "Максимальный рейтинг", "rating": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = Review.objects.get(user=self.user, course=self.second_course)
        self.assertEqual(review.rating, 5)
        self.assertEqual(response.data["comment"], review.text)

    def test_create_review_rejects_rating_below_min_value(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Слишком низкий рейтинг", "rating": 0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["rating"][0].code, "min_value")

    def test_create_review_rejects_rating_above_max_value(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Слишком высокий рейтинг", "rating": 6},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["rating"][0].code, "max_value")

    def test_create_review_requires_auth(self):
        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Без авторизации", "rating": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_review_requires_enrollment(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Хочу оставить отзыв", "rating": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["course_id"][0], "You are not enrolled in this course.")

    def test_create_second_review_for_same_course_is_forbidden(self):
        self.create_review()
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Второй отзыв", "rating": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["course_id"][0], "You have already reviewed this course.")

    def test_get_approved_reviews_for_course(self):
        Review.objects.create(
            user=self.user,
            course=self.course,
            text="Одобренный отзыв",
            rating=5,
            status=ReviewStatus.APPROVED,
        )
        Review.objects.create(
            user=self.other_user,
            course=self.course,
            text="Отклоненный отзыв",
            rating=2,
            status=ReviewStatus.REJECTED,
        )
        Review.objects.create(
            user=self.user,
            course=self.second_course,
            text="Другой курс",
            rating=4,
            status=ReviewStatus.APPROVED,
        )

        response = self.client.get(reverse("review-course-list", kwargs={"course_id": self.course.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["review_id"], str(Review.objects.get(course=self.course, status=ReviewStatus.APPROVED).id))
        self.assertEqual(response.data[0]["comment"], "Одобренный отзыв")
        self.assertEqual(response.data[0]["user_email"], self.user.email)
        self.assertEqual(response.data[0]["rating"], 5)
        self.assertNotIn("text", response.data[0])

    def test_get_my_reviews(self):
        Review.objects.create(
            user=self.user,
            course=self.course,
            text="На проверке",
            rating=1,
            status=ReviewStatus.PENDING,
        )
        Review.objects.create(
            user=self.user,
            course=self.second_course,
            text="Отклонен",
            rating=5,
            status=ReviewStatus.REJECTED,
        )
        Review.objects.create(
            user=self.other_user,
            course=self.second_course,
            text="Чужой отзыв",
            rating=3,
            status=ReviewStatus.APPROVED,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("review-my-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual({item["status"] for item in response.data}, {ReviewStatus.PENDING, ReviewStatus.REJECTED})
        self.assertEqual({item["rating"] for item in response.data}, {1, 5})
        self.assertEqual({item["course_id"] for item in response.data}, {str(self.course.id), str(self.second_course.id)})
        self.assertTrue(all("comment" in item for item in response.data))

    def test_author_can_update_own_review(self):
        review = self.create_review(status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Обновленный отзыв", "rating": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.text, "Обновленный отзыв")
        self.assertEqual(review.rating, 5)
        self.assertEqual(review.status, ReviewStatus.PENDING)
        self.assertEqual(response.data["review_id"], str(review.id))

    def test_update_review_allows_changing_only_comment(self):
        review = self.create_review(text="Старый комментарий", rating=4, status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Новый комментарий"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.text, "Новый комментарий")
        self.assertEqual(review.rating, 4)
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_update_review_allows_changing_only_rating(self):
        review = self.create_review(text="Комментарий", rating=2, status=ReviewStatus.REJECTED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"rating": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.text, "Комментарий")
        self.assertEqual(review.rating, 5)
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_update_review_allows_changing_comment_and_rating_together(self):
        review = self.create_review(text="Было", rating=1, status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Стало", "rating": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.text, "Стало")
        self.assertEqual(review.rating, 3)
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_update_approved_review_resets_status_to_pending(self):
        review = self.create_review(status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Обновлен после модерации"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_update_rejected_review_resets_status_to_pending(self):
        review = self.create_review(status=ReviewStatus.REJECTED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Исправленный отзыв"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_update_pending_review_keeps_status_pending(self):
        review = self.create_review(status=ReviewStatus.PENDING)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Новая версия"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, ReviewStatus.PENDING)

    def test_other_user_cannot_update_foreign_review(self):
        review = self.create_review()
        self.client.force_authenticate(user=self.other_user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Чужое изменение"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        review.refresh_from_db()
        self.assertEqual(review.text, "Первый отзыв")

    def test_update_review_requires_auth(self):
        review = self.create_review()

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Без авторизации"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_user_cannot_update_review(self):
        blocked_user = Account.objects.create_user(
            email="blocked-reviewer@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="User",
            status=AccountStatus.BLOCKED,
        )
        review = self.create_review(user=blocked_user)
        self.authenticate_with_jwt(blocked_user)

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Попытка blocked user"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_update_review_forbids_course_changes(self):
        review = self.create_review(status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"course": str(self.second_course.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        review.refresh_from_db()
        self.assertEqual(review.course, self.course)
        self.assertEqual(response.data["course"][0], "This field cannot be updated.")

    def test_update_review_forbids_user_changes(self):
        review = self.create_review(status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"user": str(self.other_user.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        review.refresh_from_db()
        self.assertEqual(review.user, self.user)
        self.assertEqual(response.data["user"][0], "This field cannot be updated.")

    def test_update_review_rejects_rating_below_min_value(self):
        review = self.create_review()
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"rating": 0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["rating"][0].code, "min_value")

    def test_update_review_rejects_rating_above_max_value(self):
        review = self.create_review()
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.get_update_url(review),
            {"rating": 6},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["rating"][0].code, "max_value")

    def test_update_review_keeps_same_object_and_does_not_create_new_one(self):
        review = self.create_review(status=ReviewStatus.APPROVED)
        self.client.force_authenticate(user=self.user)
        reviews_before = Review.objects.count()

        response = self.client.patch(
            self.get_update_url(review),
            {"comment": "Тот же объект", "rating": 2},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Review.objects.count(), reviews_before)
        self.assertTrue(Review.objects.filter(id=review.id, user=self.user, course=self.course).exists())


class AdminReviewModerationApiTests(APITestCase):
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
        self.other_user = Account.objects.create_user(
            email="other@example.com",
            password="StrongPass123",
            first_name="Other",
            last_name="User",
        )
        self.course = Course.objects.create(
            title="Moderated course",
            short_description="desc",
            content="# content",
            status=CourseStatus.AVAILABLE,
        )
        self.second_course = Course.objects.create(
            title="Second course",
            short_description="desc 2",
            content="# content 2",
            status=CourseStatus.AVAILABLE,
        )
        self.pending_review = Review.objects.create(
            user=self.regular_user,
            course=self.course,
            text="Needs review",
            rating=4,
            status=ReviewStatus.PENDING,
        )
        self.approved_review = Review.objects.create(
            user=self.other_user,
            course=self.second_course,
            text="Already approved",
            rating=5,
            status=ReviewStatus.APPROVED,
        )
        self.rejected_review = Review.objects.create(
            user=self.other_user,
            course=self.course,
            text="Rejected review",
            rating=2,
            status=ReviewStatus.REJECTED,
        )

    def authenticate_with_jwt(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def get_admin_list_url(self):
        return reverse("admin-review-list")

    def get_admin_pending_list_url(self):
        return reverse("admin-review-pending-list")

    def get_admin_detail_url(self, review):
        return reverse("admin-review-moderate", kwargs={"pk": review.id})

    def test_admin_can_get_review_list(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        self.assertEqual([item["review_id"] for item in response.data], [str(self.pending_review.id), str(self.approved_review.id), str(self.rejected_review.id)])
        self.assertEqual(response.data[0]["review_id"], str(self.pending_review.id))
        self.assertEqual(response.data[0]["user_id"], str(self.regular_user.id))
        self.assertEqual(response.data[0]["user_email"], self.regular_user.email)
        self.assertEqual(response.data[0]["course_id"], str(self.course.id))
        self.assertEqual(response.data[0]["course_title"], self.course.title)
        self.assertEqual(response.data[0]["comment"], self.pending_review.text)
        self.assertEqual(response.data[0]["status"], ReviewStatus.PENDING)

    def test_regular_user_cannot_get_review_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_cannot_get_review_list(self):
        response = self.client.get(self.get_admin_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_review_list(self):
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

    def test_admin_can_get_pending_review_list(self):
        newer_pending_review = Review.objects.create(
            user=self.admin_user,
            course=self.second_course,
            text="Newest pending review",
            rating=3,
            status=ReviewStatus.PENDING,
        )
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_pending_list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(
            [item["review_id"] for item in response.data],
            [str(newer_pending_review.id), str(self.pending_review.id)],
        )
        self.assertEqual({item["status"] for item in response.data}, {ReviewStatus.PENDING})
        self.assertNotIn(str(self.approved_review.id), [item["review_id"] for item in response.data])
        self.assertNotIn(str(self.rejected_review.id), [item["review_id"] for item in response.data])

    def test_regular_user_cannot_get_pending_review_list(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.get_admin_pending_list_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_cannot_get_pending_review_list(self):
        response = self.client.get(self.get_admin_pending_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_admin_cannot_get_pending_review_list(self):
        blocked_admin = Account.objects.create_user(
            email="blocked-pending-admin@example.com",
            password="StrongPass123",
            first_name="Blocked",
            last_name="Admin",
            role=AccountRole.ADMIN,
            is_staff=True,
            status=AccountStatus.BLOCKED,
        )
        self.authenticate_with_jwt(blocked_admin)

        response = self.client.get(self.get_admin_pending_list_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User account is blocked.")

    def test_pending_review_list_has_same_response_structure_as_admin_review_list(self):
        self.client.force_authenticate(user=self.admin_user)

        pending_response = self.client.get(self.get_admin_pending_list_url())
        list_response = self.client.get(self.get_admin_list_url(), {"status": ReviewStatus.PENDING})

        self.assertEqual(pending_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(pending_response.data, list_response.data)

    def test_admin_can_filter_reviews_by_status(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.get_admin_list_url(), {"status": ReviewStatus.APPROVED})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["review_id"], str(self.approved_review.id))
        self.assertEqual(response.data[0]["status"], ReviewStatus.APPROVED)

    def test_admin_can_change_status_to_approved(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.pending_review),
            {"status": ReviewStatus.APPROVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_review.refresh_from_db()
        self.assertEqual(self.pending_review.status, ReviewStatus.APPROVED)
        self.assertEqual(response.data["status"], ReviewStatus.APPROVED)

    def test_admin_can_change_status_to_rejected(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.pending_review),
            {"status": ReviewStatus.REJECTED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_review.refresh_from_db()
        self.assertEqual(self.pending_review.status, ReviewStatus.REJECTED)
        self.assertEqual(response.data["status"], ReviewStatus.REJECTED)

    def test_admin_cannot_set_invalid_status(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.pending_review),
            {"status": "invalid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.pending_review.refresh_from_db()
        self.assertEqual(self.pending_review.status, ReviewStatus.PENDING)

    def test_regular_user_cannot_change_status(self):
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.patch(
            self.get_admin_detail_url(self.pending_review),
            {"status": ReviewStatus.APPROVED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.pending_review.refresh_from_db()
        self.assertEqual(self.pending_review.status, ReviewStatus.PENDING)

    def test_admin_patch_cannot_change_comment_rating_user_or_course(self):
        self.client.force_authenticate(user=self.admin_user)
        original_text = self.pending_review.text
        original_rating = self.pending_review.rating
        original_user = self.pending_review.user
        original_course = self.pending_review.course

        response = self.client.patch(
            self.get_admin_detail_url(self.pending_review),
            {
                "status": ReviewStatus.APPROVED,
                "comment": "Tampered comment",
                "rating": 1,
                "user": str(self.other_user.id),
                "course": str(self.second_course.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.pending_review.refresh_from_db()
        self.assertEqual(self.pending_review.status, ReviewStatus.PENDING)
        self.assertEqual(self.pending_review.text, original_text)
        self.assertEqual(self.pending_review.rating, original_rating)
        self.assertEqual(self.pending_review.user, original_user)
        self.assertEqual(self.pending_review.course, original_course)
        self.assertEqual(response.data["comment"][0], "This field cannot be updated.")
        self.assertEqual(response.data["rating"][0], "This field cannot be updated.")
        self.assertEqual(response.data["user"][0], "This field cannot be updated.")
        self.assertEqual(response.data["course"][0], "This field cannot be updated.")
