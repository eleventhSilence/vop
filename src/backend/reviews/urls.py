from django.urls import path

from reviews.views import CourseApprovedReviewListView, MyReviewListView, ReviewCreateView, ReviewUpdateView


urlpatterns = [
    path("", ReviewCreateView.as_view(), name="review-create"),
    path("<uuid:pk>/", ReviewUpdateView.as_view(), name="review-update"),
    path("course/<uuid:course_id>/", CourseApprovedReviewListView.as_view(), name="review-course-list"),
    path("my/", MyReviewListView.as_view(), name="review-my-list"),
]
