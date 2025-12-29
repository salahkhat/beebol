import os
from django.core.wsgi import get_wsgi_application
from wsgi_adapter import handler as wsgi_handler

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beebol_backend.settings')

app = get_wsgi_application()
handler = wsgi_handler(app)
