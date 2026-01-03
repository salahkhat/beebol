from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0028_savedsearch_last_new_count"),
        ("messaging", "0004_shadowed_flags"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Offer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(default="SYP", max_length=8)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("rejected", "Rejected"),
                            ("countered", "Countered"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                (
                    "buyer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers_as_buyer",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "seller",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers_as_seller",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers",
                        to="market.listing",
                    ),
                ),
                (
                    "thread",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers",
                        to="messaging.privatethread",
                    ),
                ),
                (
                    "counter_of",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="counters",
                        to="messaging.offer",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="offer",
            index=models.Index(fields=["thread", "created_at"], name="offer_thread_created_idx"),
        ),
        migrations.AddIndex(
            model_name="offer",
            index=models.Index(fields=["listing", "created_at"], name="offer_listing_created_idx"),
        ),
        migrations.AddField(
            model_name="privatemessage",
            name="offer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="messages",
                to="messaging.offer",
            ),
        ),
    ]
