from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path('api/', include('api.urls')),
    path('django-admin/', admin.site.urls),
]


def api_404(request, exception=None):
    """
    Keeps the `{ "message": ... }` envelope for unmatched API paths so the Angular
    ApiService can read `message` off a 404 the same way it does every other error.

    Django only routes to this when DEBUG is False; with DEBUG on you get the usual
    URL-pattern debug page instead, which is more useful while developing.
    """
    if request.path.startswith('/api/'):
        return JsonResponse(
            {'message': f'Cannot {request.method} {request.path}'}, status=404
        )

    return JsonResponse({'message': 'Not found'}, status=404)


def api_500(request):
    return JsonResponse({'message': 'Internal server error'}, status=500)


handler404 = 'config.urls.api_404'
handler500 = 'config.urls.api_500'
