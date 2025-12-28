from django.contrib import admin, messages
from django.core.management import call_command
from django.http import HttpResponseNotAllowed
from django.shortcuts import redirect
from django.urls import path

from .models import (
    Category,
    CategoryAttributeDefinition,
    City,
    Governorate,
    Listing,
    ListingAttributeValue,
    ListingImage,
    Neighborhood,
)


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
    change_list_template = "admin/market/listing/change_list.html"

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

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "seed/",
                self.admin_site.admin_view(self.seed_listings_view),
                name="market_listing_seed",
            ),
            path(
                "clear/",
                self.admin_site.admin_view(self.clear_listings_view),
                name="market_listing_clear",
            ),
        ]
        return custom_urls + urls

    def seed_listings_view(self, request):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        if not self.has_add_permission(request):
            self.message_user(request, "You do not have permission to seed listings.", level=messages.ERROR)
            return redirect("..")

        try:
            call_command("seed_listings", per_category=5)
            self.message_user(request, "Seeded listings: 5 per category.", level=messages.SUCCESS)
        except Exception as exc:  # noqa: BLE001 - show error in admin UI
            self.message_user(request, f"Seeding failed: {exc}", level=messages.ERROR)

        return redirect("..")

    def clear_listings_view(self, request):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        if not self.has_delete_permission(request):
            self.message_user(request, "You do not have permission to clear listings.", level=messages.ERROR)
            return redirect("..")

        deleted_count, _by_model = Listing.objects.all().delete()
        self.message_user(request, f"Cleared {deleted_count} objects (including related data).", level=messages.SUCCESS)
        return redirect("..")


@admin.register(CategoryAttributeDefinition)
class CategoryAttributeDefinitionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "category",
        "key",
        "type",
        "is_required_in_post",
        "is_filterable",
        "sort_order",
    )
    list_filter = ("type", "is_required_in_post", "is_filterable", "category")
    search_fields = ("key", "label_ar", "label_en")


@admin.register(ListingAttributeValue)
class ListingAttributeValueAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "definition", "int_value", "decimal_value", "enum_value", "bool_value")
    list_filter = ("definition",)
    search_fields = ("definition__key", "enum_value", "text_value")
