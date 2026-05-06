from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static

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
    url=getattr(settings, "SWAGGER_API_URL", None),
)

urlpatterns = [
    path(start + "admin/", include("accounts.admin_urls")),
    path(start + "admin/", include("reviews.admin_urls")),
    path(start + "admin/", include("courses.admin_urls")),
    path(start + "admin/", include("testing.admin_urls")),
    path(start + "admin/", admin.site.urls),
    path(start, include("accounts.urls")),
    path(start + "courses/", include("courses.urls")),
    path(start + "testing/", include("testing.urls")),
    path(start + "reviews/", include("reviews.urls")),
    path(start + "progress/", include("progress.urls")),

    path(start + "swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="swagger-ui"),
    path(start + "redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
