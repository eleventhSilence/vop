from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Account
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
        self.assertEqual(response.data["course"][0], "You are not enrolled in this course.")

    def test_create_second_review_for_same_course_is_forbidden(self):
        Review.objects.create(user=self.user, course=self.course, text="Первый отзыв", rating=4)
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("review-create"),
            {"course": str(self.course.id), "text": "Второй отзыв", "rating": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["course"][0], "You have already reviewed this course.")

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
        self.assertEqual(response.data[0]["text"], "Одобренный отзыв")
        self.assertEqual(response.data[0]["user"], self.user.email)
        self.assertEqual(response.data[0]["rating"], 5)

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
