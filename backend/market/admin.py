from django.contrib import admin

from .models import Category, City, Governorate, Listing, ListingImage, Neighborhood


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "slug", "parent")
    list_filter = ("parent",)
    search_fields = ("name_ar", "name_en", "slug")


@admin.register(Governorate)
class GovernorateAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "slug")
    search_fields = ("name_ar", "name_en", "slug")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "slug", "governorate")
    list_filter = ("governorate",)
    search_fields = ("name_ar", "name_en", "slug")


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ar", "name_en", "slug", "city")
    list_filter = ("city", "city__governorate")
    search_fields = ("name_ar", "name_en", "slug")


class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 0


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "seller",
        "status",
        "moderation_status",
        "is_flagged",
        "is_removed",
        "city",
        "created_at",
    )
    list_filter = ("status", "moderation_status", "is_flagged", "is_removed", "governorate", "city")
    search_fields = ("title", "description")
    inlines = [ListingImageInline]

    actions = [
        "approve",
        "reject",
        "mark_removed",
        "restore",
        "flag",
        "unflag",
    ]

    @admin.action(description="Approve selected listings")
    def approve(self, request, queryset):
        queryset.update(moderation_status="approved")

    @admin.action(description="Reject selected listings")
    def reject(self, request, queryset):
        queryset.update(moderation_status="rejected")

    @admin.action(description="Remove selected listings")
    def mark_removed(self, request, queryset):
        queryset.update(is_removed=True)

    @admin.action(description="Restore selected listings")
    def restore(self, request, queryset):
        queryset.update(is_removed=False)

    @admin.action(description="Flag selected listings")
    def flag(self, request, queryset):
        queryset.update(is_flagged=True)

    @admin.action(description="Unflag selected listings")
    def unflag(self, request, queryset):
        queryset.update(is_flagged=False)
