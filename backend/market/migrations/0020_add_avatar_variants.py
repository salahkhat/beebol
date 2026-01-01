# Generated manual migration to add avatar variants
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('market', '0019_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='avatar_medium',
            field=models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/avatars/medium/{fn}", null=True, blank=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='avatar_thumbnail',
            field=models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/avatars/thumb/{fn}", null=True, blank=True),
        ),
    ]
