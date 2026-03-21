from django.contrib import admin
from django.urls import path, include, re_path

from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

start = "api/"

schema_view = get_schema_view(
    openapi.Info(
        title="API",
        default_version="v1",
        description="Project API documentation",
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
    url="http://127.0.0.1:8000",  # <- важно
)

urlpatterns = [
    path(start + "admin/", admin.site.urls),
    path(start, include("accounts.urls")),
    path(start + "courses/", include("courses.urls")),
    path(start + "testing/", include("testing.urls")),
    path(start + "reviews/", include("reviews.urls")),
    path(start + "progress/", include("progress.urls")),

    path(start + "swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="swagger-ui"),
    path(start + "redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
]
