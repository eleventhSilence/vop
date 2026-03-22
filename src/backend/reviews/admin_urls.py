from django.urls import path

from reviews.views import AdminReviewListView, AdminReviewModerationView


urlpatterns = [
    path("reviews/", AdminReviewListView.as_view(), name="admin-review-list"),
    path("reviews/<uuid:pk>/", AdminReviewModerationView.as_view(), name="admin-review-moderate"),
]
