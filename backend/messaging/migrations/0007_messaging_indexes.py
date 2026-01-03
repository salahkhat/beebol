from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0006_thread_buyer_checklist"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="publicquestion",
            index=models.Index(fields=["listing", "created_at"], name="pq_listing_created_idx"),
        ),
        migrations.AddIndex(
            model_name="privatethread",
            index=models.Index(fields=["buyer", "created_at"], name="pth_buyer_created_idx"),
        ),
        migrations.AddIndex(
            model_name="privatethread",
            index=models.Index(fields=["seller", "created_at"], name="pth_seller_created_idx"),
        ),
        migrations.AddIndex(
            model_name="privatethread",
            index=models.Index(fields=["listing", "created_at"], name="pth_listing_created_idx"),
        ),
        migrations.AddIndex(
            model_name="privatemessage",
            index=models.Index(fields=["thread", "created_at"], name="pm_thread_created_idx"),
        ),
        migrations.AddIndex(
            model_name="privatemessage",
            index=models.Index(fields=["sender", "created_at"], name="pm_sender_created_idx"),
        ),
    ]
