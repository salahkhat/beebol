from django.contrib import admin

from .models import ListingReport, UserReport


@admin.register(ListingReport)
class ListingReportAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "reporter", "reason", "status", "created_at", "handled_at")
    list_filter = ("status", "reason")
    search_fields = ("reason", "message", "reporter__username", "listing__title")
    readonly_fields = ("created_at", "updated_at", "handled_at")


@admin.register(UserReport)
class UserReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reported", "reporter", "reason", "status", "created_at", "handled_at")
    list_filter = ("status", "reason")
    search_fields = ("reason", "message", "reporter__username", "reported__username")
    readonly_fields = ("created_at", "updated_at", "handled_at")
