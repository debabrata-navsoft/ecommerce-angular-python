from rest_framework.permissions import BasePermission


class IsAuthenticated(BasePermission):
    """
    Local version because REST_FRAMEWORK sets UNAUTHENTICATED_USER to None, so
    `request.user` is None rather than an AnonymousUser instance.
    """

    def has_permission(self, request, view):
        return request.user is not None


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user is not None and request.user.is_admin


class IsSelfOrAdmin(BasePermission):
    """
    Lets a user reach their own sub-resources while admins reach anyone's. The view
    supplies the id under the `user_id` URL kwarg.
    """

    def has_permission(self, request, view):
        user = request.user
        if user is None:
            return False
        if user.is_admin:
            return True

        return str(user.id) == str(view.kwargs.get('user_id'))
