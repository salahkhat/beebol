# Manual migration to add cover_medium to Profile
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('market', '0021_merge_profile_branches'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='cover_medium',
            field=models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/covers/medium/{fn}", null=True, blank=True),
        ),
    ]
