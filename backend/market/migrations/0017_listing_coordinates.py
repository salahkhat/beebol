from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0016_seed_taxonomy_logical_attributes"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="listing",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
