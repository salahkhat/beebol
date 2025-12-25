from django.db import migrations
from django.utils.text import slugify


def seed_more_categories(apps, schema_editor):
    Category = apps.get_model('market', 'Category')

    def unique_slug(base: str, used: set[str]) -> str:
        s = slugify(base) or 'category'
        if s not in used:
            used.add(s)
            return s
        i = 2
        while f"{s}-{i}" in used:
            i += 1
        s2 = f"{s}-{i}"
        used.add(s2)
        return s2

    existing = set(Category.objects.values_list('slug', flat=True))

    def upsert(slug: str, name_ar: str, name_en: str = '', parent_slug: str | None = None):
        parent = None
        if parent_slug:
            parent = Category.objects.filter(slug=parent_slug).first()

        obj, _created = Category.objects.get_or_create(
            slug=slug,
            defaults={
                'name_ar': name_ar,
                'name_en': name_en,
                'parent': parent,
            },
        )

        updates = {}
        if obj.name_ar != name_ar:
            updates['name_ar'] = name_ar
        if obj.name_en != name_en:
            updates['name_en'] = name_en
        if obj.parent_id != (parent.id if parent else None):
            updates['parent'] = parent
        if updates:
            for k, v in updates.items():
                setattr(obj, k, v)
            obj.save(update_fields=list(updates.keys()))

        existing.add(slug)
        return obj

    # Ensure a few missing top-level buckets exist.
    top_levels = [
        ('sports', 'رياضة وهوايات', 'Sports & Hobbies'),
        ('business-industrial', 'معدات وأعمال', 'Business & Industrial'),
        ('beauty-health', 'جمال وصحة', 'Beauty & Health'),
        ('books', 'كتب', 'Books'),
        ('food', 'طعام ومشروبات', 'Food & Drinks'),
        ('mobile-internet', 'اتصالات وإنترنت', 'Mobile & Internet'),
        ('other', 'أخرى', 'Other'),
    ]

    for slug, ar, en in top_levels:
        if slug not in existing:
            upsert(slug, ar, en)

    # Build a large (500+ nodes) taxonomy by expanding common second-level nodes
    # into third-level nodes. Arabic is required in the DB; for generated leaves
    # we mirror English when a precise Arabic label isn't available.

    # Second-level expansions by parent slug.
    # Prefer existing slugs from 0003 (e.g., phones/computers/tv-audio) to avoid duplicates.
    expansions = {
        'electronics': [
            ('phones', 'هواتف', 'Phones'),
            ('computers', 'كمبيوتر ولابتوب', 'Computers'),
            ('tv-audio', 'تلفزيون وصوتيات', 'TV & Audio'),
            ('gaming', 'ألعاب', 'Gaming'),
            ('cameras', 'كاميرات', 'Cameras'),
            ('electronics-accessories', 'إكسسوارات إلكترونيات', 'Electronics Accessories'),
        ],
        'vehicles': [
            ('cars', 'سيارات', 'Cars'),
            ('motorcycles', 'دراجات نارية', 'Motorcycles'),
            ('car-parts', 'قطع غيار', 'Parts'),
            ('trucks-vans', 'شاحنات وفانات', 'Trucks & Vans'),
        ],
        'real-estate': [
            ('apartments-rent', 'شقق للإيجار', 'Apartments for Rent'),
            ('apartments-sale', 'شقق للبيع', 'Apartments for Sale'),
            ('houses-villas', 'بيوت وفلل', 'Houses & Villas'),
            ('land', 'أراضي', 'Land'),
            ('shops', 'محلات', 'Shops'),
            ('offices', 'مكاتب', 'Offices'),
        ],
        'home': [
            ('furniture', 'أثاث', 'Furniture'),
            ('appliances', 'أجهزة منزلية', 'Appliances'),
            ('kitchenware', 'مستلزمات المطبخ', 'Kitchenware'),
            ('decor', 'ديكور', 'Home Decor'),
            ('tools-diy', 'أدوات ومعدات', 'Tools & DIY'),
        ],
        'fashion': [
            ('mens-fashion', 'رجالي', 'Men'),
            ('womens-fashion', 'نسائي', 'Women'),
            ('kids-fashion', 'ملابس أطفال', 'Kids Clothing'),
            ('shoes', 'أحذية', 'Shoes'),
            ('bags-accessories', 'حقائب وإكسسوارات', 'Bags & Accessories'),
            ('watches-jewelry', 'ساعات ومجوهرات', 'Watches & Jewelry'),
        ],
        'kids': [
            ('baby-supplies', 'مستلزمات أطفال', 'Baby Supplies'),
            ('toys', 'ألعاب', 'Toys'),
            ('strollers-seats', 'عربات ومقاعد سيارة', 'Strollers & Car Seats'),
            ('school-supplies', 'مستلزمات مدرسية', 'School Supplies'),
        ],
        'services': [
            ('repairs', 'صيانة وإصلاح', 'Repairs'),
            ('delivery', 'توصيل', 'Delivery'),
            ('home-services', 'خدمات منزلية', 'Home Services'),
            ('lessons', 'دروس وتعليم', 'Lessons & Tutoring'),
            ('events', 'مناسبات', 'Events'),
            ('design-media', 'تصميم وإعلام', 'Design & Media'),
        ],
        'animals': [
            ('cats', 'قطط', 'Cats'),
            ('dogs', 'كلاب', 'Dogs'),
            ('birds', 'طيور', 'Birds'),
            ('fish', 'أسماك', 'Fish'),
            ('farm-animals', 'حيوانات مزرعة', 'Farm Animals'),
            ('pet-supplies', 'مستلزمات الحيوانات', 'Pet Supplies'),
        ],
        'sports': [
            ('gym-fitness', 'لياقة بدنية', 'Gym & Fitness'),
            ('football', 'كرة قدم', 'Football'),
            ('cycling', 'دراجات', 'Cycling'),
            ('camping', 'تخييم', 'Camping'),
            ('music', 'موسيقى', 'Music'),
        ],
        'business-industrial': [
            ('office-supplies', 'مستلزمات مكتب', 'Office Supplies'),
            ('machines-tools', 'آلات وأدوات', 'Machines & Tools'),
            ('restaurant-equipment', 'معدات مطاعم', 'Restaurant Equipment'),
            ('industrial-supplies', 'مستلزمات صناعية', 'Industrial Supplies'),
        ],
        'beauty-health': [
            ('skincare', 'عناية بالبشرة', 'Skincare'),
            ('haircare', 'عناية بالشعر', 'Haircare'),
            ('makeup', 'مكياج', 'Makeup'),
            ('fragrance', 'عطور', 'Fragrance'),
            ('supplements', 'مكملات', 'Supplements'),
        ],
        'books': [
            ('textbooks', 'كتب دراسية', 'Textbooks'),
            ('novels', 'روايات', 'Novels'),
            ('kids-books', 'كتب أطفال', 'Kids Books'),
            ('religion', 'دين', 'Religion'),
            ('business', 'إدارة وأعمال', 'Business'),
            ('tech', 'تقنية', 'Technology'),
        ],
        'food': [
            ('coffee-tea', 'قهوة وشاي', 'Coffee & Tea'),
            ('sweets', 'حلويات', 'Sweets'),
            ('spices', 'بهارات', 'Spices'),
            ('drinks', 'مشروبات', 'Drinks'),
        ],
        'mobile-internet': [
            ('sim-cards', 'شرائح اتصال', 'SIM Cards'),
            ('internet-devices', 'أجهزة إنترنت', 'Internet Devices'),
            ('routers', 'راوترات', 'Routers'),
            ('plans', 'باقات', 'Plans'),
        ],
        'other': [
            ('misc', 'متفرقات', 'Misc'),
        ],
    }

    # Third-level templates: chosen to be fairly universal without being overly specific.
    third_level_templates = {
        'phones': ['Android', 'iPhone', 'Tablet', 'Accessories', 'Spare Parts', 'Repair'],
        'computers': ['Laptop', 'Desktop', 'Components', 'Peripherals', 'Accessories', 'Repair'],
        'tv-audio': ['TV', 'Speakers', 'Headphones', 'Receivers', 'Accessories'],
        'gaming': ['Consoles', 'Games', 'Controllers', 'Accessories', 'PC Gaming'],
        'cameras': ['DSLR', 'Mirrorless', 'Action Cameras', 'Lenses', 'Accessories'],
        'electronics-accessories': ['Chargers', 'Cables', 'Power Banks', 'Adapters', 'Cases'],
        'cars': ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Luxury'],
        'motorcycles': ['Scooter', 'Sport', 'Cruiser', 'Off-road', 'Parts'],
        'trucks-vans': ['Light Trucks', 'Heavy Trucks', 'Delivery Vans', 'Minibus', 'Parts'],
        'car-parts': ['Engine', 'Tires', 'Batteries', 'Interior', 'Exterior', 'Electronics'],
        'apartments-rent': ['Studio', '1 Bedroom', '2 Bedrooms', '3+ Bedrooms', 'Furnished', 'Short Term'],
        'apartments-sale': ['Studio', '1 Bedroom', '2 Bedrooms', '3+ Bedrooms', 'New', 'Resale'],
        'houses-villas': ['House', 'Villa', 'Duplex', 'Farm House', 'New', 'Resale'],
        'land': ['Residential', 'Commercial', 'Agricultural', 'Industrial'],
        'shops': ['Shop', 'Warehouse', 'Clinic', 'Salon', 'Other'],
        'offices': ['Office', 'Coworking', 'Floor', 'Other'],
        'furniture': ['Living Room', 'Bedroom', 'Dining', 'Office', 'Outdoor', 'Accessories'],
        'appliances': ['Kitchen', 'Laundry', 'Cooling', 'Heating', 'Small Appliances'],
        'kitchenware': ['Cookware', 'Tableware', 'Storage', 'Knives', 'Small Tools'],
        'decor': ['Lighting', 'Rugs', 'Curtains', 'Wall Decor', 'Plants'],
        'tools-diy': ['Hand Tools', 'Power Tools', 'Building Materials', 'Paint', 'Safety'],
        'mens-fashion': ['Tops', 'Bottoms', 'Outerwear', 'Traditional', 'Accessories'],
        'womens-fashion': ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Accessories'],
        'kids-fashion': ['Boys', 'Girls', 'Baby', 'Shoes', 'Accessories'],
        'shoes': ['Men Shoes', 'Women Shoes', 'Kids Shoes', 'Sports Shoes', 'Sandals'],
        'bags-accessories': ['Bags', 'Wallets', 'Belts', 'Sunglasses', 'Hats'],
        'watches-jewelry': ['Watches', 'Rings', 'Necklaces', 'Bracelets', 'Earrings'],
        'baby-supplies': ['Diapers', 'Feeding', 'Bath', 'Health', 'Carriers'],
        'toys': ['Educational', 'Outdoor', 'Board Games', 'Dolls', 'Vehicles'],
        'strollers-seats': ['Strollers', 'Car Seats', 'Boosters', 'Accessories'],
        'school-supplies': ['Bags', 'Stationery', 'Uniforms', 'Books', 'Electronics'],
        'repairs': ['Phones', 'Appliances', 'Cars', 'Computers', 'Home'],
        'delivery': ['Food', 'Packages', 'Furniture', 'Same Day', 'Intercity'],
        'home-services': ['Cleaning', 'Plumbing', 'Electricity', 'Painting', 'Moving'],
        'lessons': ['Languages', 'Math', 'School', 'Music', 'Programming'],
        'events': ['Photography', 'Catering', 'DJ', 'Decoration', 'Venues'],
        'design-media': ['Graphic Design', 'Video Editing', 'Photography', 'Social Media', 'Printing'],
        'gym-fitness': ['Treadmills', 'Weights', 'Accessories', 'Supplements', 'Wearables'],
        'football': ['Balls', 'Shoes', 'Clothing', 'Goals', 'Accessories'],
        'cycling': ['Bikes', 'Helmets', 'Parts', 'Accessories', 'Repair'],
        'camping': ['Tents', 'Sleeping', 'Cooking', 'Lights', 'Accessories'],
        'music': ['Instruments', 'Audio Gear', 'Lessons', 'Accessories'],
        'office-supplies': ['Paper', 'Printers', 'Chairs', 'Desks', 'Storage'],
        'machines-tools': ['Compressors', 'Generators', 'Welding', 'Hand Tools', 'Power Tools'],
        'restaurant-equipment': ['Ovens', 'Fridges', 'Tables', 'Small Tools', 'Coffee Machines'],
        'industrial-supplies': ['Safety', 'Packaging', 'Raw Materials', 'Spare Parts'],
        'skincare': ['Cleansers', 'Moisturizers', 'Sunscreen', 'Treatments', 'Tools'],
        'haircare': ['Shampoo', 'Conditioner', 'Treatments', 'Tools', 'Styling'],
        'makeup': ['Face', 'Eyes', 'Lips', 'Brushes', 'Palettes'],
        'fragrance': ['Men', 'Women', 'Unisex', 'Gift Sets'],
        'supplements': ['Vitamins', 'Protein', 'Herbal', 'Fitness'],
        'textbooks': ['School', 'University', 'Languages', 'Exam Prep'],
        'novels': ['Arabic', 'English', 'Classics', 'Modern'],
        'kids-books': ['Picture Books', 'Early Readers', 'Learning', 'Stories'],
        'religion': ['Quran', 'Hadith', 'Fiqh', 'History'],
        'business': ['Management', 'Finance', 'Marketing', 'Entrepreneurship'],
        'tech': ['Programming', 'Networking', 'AI', 'Cybersecurity'],
        'coffee-tea': ['Coffee', 'Tea', 'Machines', 'Accessories'],
        'sweets': ['Chocolate', 'Biscuits', 'Candy', 'Homemade'],
        'spices': ['Spice Mixes', 'Herbs', 'Salt', 'Oil'],
        'drinks': ['Juice', 'Soft Drinks', 'Water', 'Energy Drinks'],
        'sim-cards': ['Prepaid', 'Postpaid', 'eSIM', 'International'],
        'internet-devices': ['MiFi', 'Modems', 'Repeaters', 'Accessories'],
        'routers': ['Home Routers', 'Mesh', 'Business Routers', 'Accessories'],
        'plans': ['Home', 'Mobile', 'Business', 'Bundles'],
        'misc': ['Other'],
        'cats': ['Kittens', 'Adult Cats', 'Food', 'Litter', 'Accessories'],
        'dogs': ['Puppies', 'Adult Dogs', 'Food', 'Accessories', 'Training'],
        'birds': ['Cages', 'Food', 'Accessories', 'Other'],
        'fish': ['Aquariums', 'Fish Food', 'Accessories', 'Other'],
        'farm-animals': ['Chickens', 'Sheep', 'Goats', 'Cows', 'Other'],
        'pet-supplies': ['Food', 'Toys', 'Beds', 'Carriers', 'Health'],
    }

    # Ensure we reliably generate 500+ total categories.
    # For each second-level category that has a template, we guarantee a minimum number of leaf nodes.
    min_leaf_count = 8
    universal_leaf_candidates = [
        'New',
        'Used',
        'Like New',
        'Refurbished',
        'For Parts',
        'Wholesale',
        'Bundle',
        'Other',
    ]

    def build_leaf_list(base: list[str]) -> list[str]:
        seen = set()
        result: list[str] = []
        for item in base:
            if item and item not in seen:
                seen.add(item)
                result.append(item)
        if len(result) < min_leaf_count:
            for item in universal_leaf_candidates:
                if item not in seen:
                    seen.add(item)
                    result.append(item)
                if len(result) >= min_leaf_count:
                    break
        return result

    # Apply expansions and generate third level.
    for parent_slug, children in expansions.items():
        # Ensure top-level exists (some are in 0003, some above).
        if parent_slug not in existing:
            # Minimal fallback label.
            upsert(parent_slug, parent_slug, parent_slug)

        for child_slug, ar, en in children:
            # Use stable slugs where provided; otherwise generate.
            if child_slug in existing:
                upsert(child_slug, ar, en, parent_slug=parent_slug)
            else:
                upsert(child_slug, ar, en, parent_slug=parent_slug)

            template = third_level_templates.get(child_slug, None)
            if not template:
                continue

            for leaf_name_en in build_leaf_list(template):
                leaf_name_ar = leaf_name_en
                leaf_slug = unique_slug(f"{child_slug}-{leaf_name_en}", existing)
                upsert(leaf_slug, leaf_name_ar, leaf_name_en, parent_slug=child_slug)


def unseed_more_categories(apps, schema_editor):
    # Keep data in place on rollback to avoid accidental data loss.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('market', '0003_seed_categories'),
    ]

    operations = [
        migrations.RunPython(seed_more_categories, unseed_more_categories),
    ]
