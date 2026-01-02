from django.contrib import admin

from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "read_at", "created_at")
    list_filter = ("kind", "read_at")
    search_fields = ("user__username", "title", "body")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "inapp_private_message",
        "inapp_question_answered",
        "inapp_listing_status",
        "email_private_message",
        "email_question_answered",
        "email_listing_status",
    )
    search_fields = ("user__username",)
