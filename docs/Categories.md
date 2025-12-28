General

    🏠 Real Estate

        Apartment
        
        House

        Building

        Land

        Office

        Shop

        Warehouse

    🚗 Vehicles

        Cars

            Sedan
        
            SUV

            Hatchback

            Pickup

            Coupe

            Convertible

            Van

        Motorcycles

            Scooter
            
            Naked

            Adventure

            Enduro

            Sport

            Cruiser

        Trucks

        Buses

        Construction Vehicles

        Agricultural Vehicles

        Vehicle Parts & Accessories

            Spare Parts

            Tires

            Vehicle Electronics

            Interior Accessories

            Exterior Accessories

    📱 Electronics

        Mobile Phones

        Mobile Accessories
        
        Tablets

        Smart Watches

        Laptops

        Desktop Computers

        Monitors

        Computer Parts

        Headphones

        Cameras

        Photography Equipments

        Drones

        Camera Accessories

        Gaming Consoles

        Video Games

        Gaming Console Accessories

    🛋️ Home & Furniture

        Living Room Furniture

            Sofas

            Armchairs

            Coffee Tables

            Side Tables

            TV Stands

            Bookcases

        Bedroom Furniture

            Beds

            Mattresses

            Wardrobes

            Nightstands

            Dressers

        Dining Furniture

            Dining Tables

            Dining Chairs

            Dining Sets

            Sideboards

        Office Furniture

            Office Desks

            Office Chairs

            Storage Cabinets

            Bookcases

        Kitchen Items

            Kitchen Cabinets

            Kitchen Tables

            Kitchen Stools

            Kitchen Shelving

            Kitchen Appliances

        Home Decor

        Lighting

        Curtains
        
        Carpets

        Home Appliances

            Refrigerators

            Washing Machines

            Dishwashers

            Ovens

            Microwaves

            Air Conditioners

            Vacuum Cleaners

    👕 Fashion

        Men’s Clothing

        Women’s Clothing

        Kids’ Clothing

        Accessories

        Shoes

        Bags

        Watches

        Jewelry

        Makeup

        Skincare

        Perfumes

    👶 Baby & Kids

        Baby Clothes

        Toys

        Strollers

        Car Seats

        Cribs & Furniture

        School Supplies

    📚 Hobbies, Sports & Leisure

        Sports Equipment
        
        Fitness Gear

        Bicycles

        Camping & Outdoor Gear

        Musical Instruments

        Books

        Board Games

        Collectibles
        
        Antiques

    🐶 Pets & Animals

        Pets 
        
            Cats
            
            Dogs

            Birds

            Fish

        Pet Food

        Pet Accessories

        Cages
        
        Aquariums

        Pet Services
        
            grooming
            
            training

            vetrinery

            pet hotel

    🛠️ Tools & Equipment

        Power Tools

        Hand Tools

        Construction Equipment

        Gardening Tools

        Industrial Equipment

    🏢 Business & Industry

        Office Equipment

        Shop Equipment

        POS Systems

        Industrial Machines

        Wholesale Items

        Business for Sale

    💼 Jobs & Services
    Jobs

        Full-time Jobs

        Part-time Jobs

        Freelance / Remote Jobs

        Temporary Work

        Services

        Home Services (plumbing, electrical)

        Cleaning Services

        Moving & Transport

        Repair Services

        IT & Tech Services

        Tutoring & Education

        Event Services

    🎁 Miscellaneous


Notes:

- All the categories should have the General Category as the Parent.

- The General Category should have the following attribs:
    - Title
    - Description
    - Location 
        - Country
        - City
        - Area
        - longitude (optional)
        - latitude (optional)
    - Show User's Phone Number (boolean, default is true).
    - Price on inquiry (boolean, default is false)
    - Price (Price on inquiry dependant) if the price is 0 then it's free that should be indicated on the UI both while creating a listing and when it's in the listings page.
    - for rent or for sale (enum) all items should implicitly be for sale except for real estate and vehicles (the attrib should not show except for these 2 categories)