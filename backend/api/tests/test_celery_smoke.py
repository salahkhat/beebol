import pytest

from api.tasks import ping


@pytest.mark.django_db
def test_celery_ping_task_eager(settings):
    # Ensure this test never depends on an external broker.
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True

    result = ping.delay().get(timeout=5)
    assert result == "pong"
