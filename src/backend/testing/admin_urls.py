from django.urls import path

from testing.views import (
    AdminCourseTestListCreateView,
    AdminCourseTestRetrieveUpdateDestroyView,
    AdminTestQuestionListCreateView,
    AdminTestQuestionRetrieveUpdateDestroyView,
)


urlpatterns = [
    path("tests/", AdminCourseTestListCreateView.as_view(), name="admin-test-list-create"),
    path("tests/<uuid:pk>/", AdminCourseTestRetrieveUpdateDestroyView.as_view(), name="admin-test-detail"),
    path("questions/", AdminTestQuestionListCreateView.as_view(), name="admin-question-list-create"),
    path("questions/<uuid:pk>/", AdminTestQuestionRetrieveUpdateDestroyView.as_view(), name="admin-question-detail"),
]
