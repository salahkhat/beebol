from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0023_favorites_savedsearches"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedsearch",
            name="notify_enabled",
            field=models.BooleanField(default=False),
        ),
    ]
