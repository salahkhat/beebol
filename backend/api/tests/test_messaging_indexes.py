import pytest
from django.db import connection

from messaging.models import PrivateMessage, PrivateThread, PublicQuestion


def _index_exists(table: str, *, name: str, columns: list[str]) -> bool:
    constraints = connection.introspection.get_constraints(connection.cursor(), table)
    info = constraints.get(name)
    if not info:
        return False
    if not info.get("index"):
        return False
    return list(info.get("columns") or []) == columns


@pytest.mark.django_db
def test_messaging_indexes_exist():
    assert _index_exists(PublicQuestion._meta.db_table, name="pq_listing_created_idx", columns=["listing_id", "created_at"])

    assert _index_exists(PrivateThread._meta.db_table, name="pth_buyer_created_idx", columns=["buyer_id", "created_at"])
    assert _index_exists(PrivateThread._meta.db_table, name="pth_seller_created_idx", columns=["seller_id", "created_at"])
    assert _index_exists(PrivateThread._meta.db_table, name="pth_listing_created_idx", columns=["listing_id", "created_at"])

    assert _index_exists(PrivateMessage._meta.db_table, name="pm_thread_created_idx", columns=["thread_id", "created_at"])
    assert _index_exists(PrivateMessage._meta.db_table, name="pm_sender_created_idx", columns=["sender_id", "created_at"])
