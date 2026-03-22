from django.urls import path

from testing.views import AdminCourseTestListCreateView, AdminCourseTestRetrieveUpdateDestroyView


urlpatterns = [
    path("tests/", AdminCourseTestListCreateView.as_view(), name="admin-test-list-create"),
    path("tests/<uuid:pk>/", AdminCourseTestRetrieveUpdateDestroyView.as_view(), name="admin-test-detail"),
]
