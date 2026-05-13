from django.urls import path

from testing.views import (
    AdminAnswerOptionListCreateView,
    AdminAnswerOptionRetrieveUpdateDestroyView,
    AdminCourseTestListCreateView,
    AdminTestAttemptRetrieveDestroyView,
    AdminTestAttemptListView,
    AdminCourseTestRetrieveUpdateDestroyView,
    AdminTestQuestionListCreateView,
    AdminTestQuestionRetrieveUpdateDestroyView,
)


urlpatterns = [
    path("tests/", AdminCourseTestListCreateView.as_view(), name="admin-test-list-create"),
    path("tests/<uuid:pk>/", AdminCourseTestRetrieveUpdateDestroyView.as_view(), name="admin-test-detail"),
    path("tests/<uuid:test_id>/attempts/", AdminTestAttemptListView.as_view(), name="admin-test-attempt-list"),
    path("testing/attempts/<uuid:pk>/", AdminTestAttemptRetrieveDestroyView.as_view(), name="admin-test-attempt-detail"),
    path("questions/", AdminTestQuestionListCreateView.as_view(), name="admin-question-list-create"),
    path("questions/<uuid:pk>/", AdminTestQuestionRetrieveUpdateDestroyView.as_view(), name="admin-question-detail"),
    path("answer-options/", AdminAnswerOptionListCreateView.as_view(), name="admin-answer-option-list-create"),
    path("answer-options/<uuid:pk>/", AdminAnswerOptionRetrieveUpdateDestroyView.as_view(), name="admin-answer-option-detail"),
]
