from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0024_savedsearch_notify_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="view_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
