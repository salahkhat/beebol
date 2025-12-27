from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("market", "0004_seed_more_categories"),
    ]

    operations = [
        migrations.CreateModel(
            name="CategoryAttributeDefinition",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key", models.SlugField(max_length=64)),
                ("label_ar", models.CharField(max_length=120)),
                ("label_en", models.CharField(blank=True, max_length=120)),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("int", "Integer"),
                            ("decimal", "Decimal"),
                            ("text", "Text"),
                            ("bool", "Boolean"),
                            ("enum", "Enum"),
                        ],
                        max_length=16,
                    ),
                ),
                ("unit", models.CharField(blank=True, max_length=24)),
                ("choices", models.JSONField(blank=True, null=True)),
                ("is_required_in_post", models.BooleanField(default=False)),
                ("is_filterable", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attribute_definitions",
                        to="market.category",
                    ),
                ),
            ],
            options={
                "ordering": ["category_id", "sort_order", "key"],
            },
        ),
        migrations.CreateModel(
            name="ListingAttributeValue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("int_value", models.IntegerField(blank=True, null=True)),
                ("decimal_value", models.DecimalField(blank=True, decimal_places=6, max_digits=18, null=True)),
                ("text_value", models.TextField(blank=True, null=True)),
                ("bool_value", models.BooleanField(blank=True, null=True)),
                ("enum_value", models.CharField(blank=True, max_length=120, null=True)),
                (
                    "definition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="values",
                        to="market.categoryattributedefinition",
                    ),
                ),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attribute_values",
                        to="market.listing",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="categoryattributedefinition",
            constraint=models.UniqueConstraint(fields=("category", "key"), name="uq_cat_attrdef_category_key"),
        ),
        migrations.AddIndex(
            model_name="categoryattributedefinition",
            index=models.Index(fields=["category", "key"], name="market_cate_category_886464_idx"),
        ),
        migrations.AddConstraint(
            model_name="listingattributevalue",
            constraint=models.UniqueConstraint(fields=("listing", "definition"), name="uq_listing_attrvalue_listing_def"),
        ),
        migrations.AddIndex(
            model_name="listingattributevalue",
            index=models.Index(fields=["definition", "int_value"], name="market_list_definition_9ce196_idx"),
        ),
        migrations.AddIndex(
            model_name="listingattributevalue",
            index=models.Index(fields=["definition", "decimal_value"], name="market_list_definition_45ba71_idx"),
        ),
        migrations.AddIndex(
            model_name="listingattributevalue",
            index=models.Index(fields=["definition", "enum_value"], name="market_list_definition_42d93d_idx"),
        ),
    ]

