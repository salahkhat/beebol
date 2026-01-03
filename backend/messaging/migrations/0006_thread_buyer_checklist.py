from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0005_offers"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ThreadBuyerChecklist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("confirmed_condition", models.BooleanField(default=False)),
                ("confirmed_location", models.BooleanField(default=False)),
                (
                    "buyer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="buyer_checklists",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "thread",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="buyer_checklist",
                        to="messaging.privatethread",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="threadbuyerchecklist",
            index=models.Index(fields=["buyer", "created_at"], name="tbc_buyer_created_idx"),
        ),
    ]
