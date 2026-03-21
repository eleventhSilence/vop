from django.urls import path

from reviews.views import CourseApprovedReviewListView, MyReviewListView, ReviewCreateView


urlpatterns = [
    path("", ReviewCreateView.as_view(), name="review-create"),
    path("course/<uuid:course_id>/", CourseApprovedReviewListView.as_view(), name="review-course-list"),
    path("my/", MyReviewListView.as_view(), name="review-my-list"),
]
