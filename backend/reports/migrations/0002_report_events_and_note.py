from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="listingreport",
            name="staff_note",
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name="ListingReportEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "from_status",
                    models.CharField(
                        choices=[("open", "Open"), ("resolved", "Resolved"), ("dismissed", "Dismissed")],
                        max_length=16,
                    ),
                ),
                (
                    "to_status",
                    models.CharField(
                        choices=[("open", "Open"), ("resolved", "Resolved"), ("dismissed", "Dismissed")],
                        max_length=16,
                    ),
                ),
                ("note", models.TextField(blank=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "report",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="reports.listingreport"),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="listingreportevent",
            index=models.Index(fields=["report", "created_at"], name="rpt_event_report_created_idx"),
        ),
        migrations.AddIndex(
            model_name="listingreportevent",
            index=models.Index(fields=["to_status", "created_at"], name="rpt_event_to_created_idx"),
        ),
    ]
