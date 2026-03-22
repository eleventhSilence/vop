from rest_framework.permissions import BasePermission

from accounts.models import AccountRole


class IsAdminUserRole(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == AccountRole.ADMIN)
