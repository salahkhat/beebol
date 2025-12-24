# Generated manually for this repo

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("market", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ListingReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reason", models.CharField(max_length=40)),
                ("message", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("open", "Open"), ("resolved", "Resolved"), ("dismissed", "Dismissed")],
                        default="open",
                        max_length=16,
                    ),
                ),
                ("handled_at", models.DateTimeField(blank=True, null=True)),
                (
                    "handled_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="handled_listing_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "listing",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reports", to="market.listing"),
                ),
                (
                    "reporter",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="listing_reports", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="listingreport",
            index=models.Index(fields=["status", "created_at"], name="rpt_status_created_idx"),
        ),
        migrations.AddIndex(
            model_name="listingreport",
            index=models.Index(fields=["listing", "status"], name="rpt_listing_status_idx"),
        ),
        migrations.AddIndex(
            model_name="listingreport",
            index=models.Index(fields=["reporter", "created_at"], name="rpt_reporter_created_idx"),
        ),
    ]
