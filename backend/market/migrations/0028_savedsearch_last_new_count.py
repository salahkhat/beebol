from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0027_listing_watchlist"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedsearch",
            name="last_new_count",
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
