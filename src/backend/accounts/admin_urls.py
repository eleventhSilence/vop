from django.urls import path

from accounts.views import AdminUserDetailView, AdminUserListView


urlpatterns = [
    path("users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("users/<uuid:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
]
