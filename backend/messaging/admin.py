from django.contrib import admin

from .models import PrivateMessage, PrivateThread, PublicQuestion


@admin.register(PublicQuestion)
class PublicQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "author", "is_shadowed", "created_at")
    search_fields = ("question", "answer")


@admin.register(PrivateThread)
class PrivateThreadAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "buyer", "seller", "created_at")


@admin.register(PrivateMessage)
class PrivateMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "thread", "sender", "is_shadowed", "created_at")
    search_fields = ("body",)
