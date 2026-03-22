from django.urls import path

from reviews.views import AdminPendingReviewListView, AdminReviewListView, AdminReviewModerationView


urlpatterns = [
    path("reviews/pending/", AdminPendingReviewListView.as_view(), name="admin-review-pending-list"),
    path("reviews/", AdminReviewListView.as_view(), name="admin-review-list"),
    path("reviews/<uuid:pk>/", AdminReviewModerationView.as_view(), name="admin-review-moderate"),
]
