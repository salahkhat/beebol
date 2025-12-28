import os
from PIL import Image

SEED_IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'seed_images')
TARGET_SIZE = (800, 600)

for root, _, files in os.walk(SEED_IMAGES_DIR):
    for fname in files:
        if fname.lower().endswith(('.png', '.jpg', '.jpeg')):
            path = os.path.join(root, fname)
            try:
                with Image.open(path) as img:
                    img = img.convert('RGB')
                    img = img.resize(TARGET_SIZE, Image.LANCZOS)
                    img.save(path, format='JPEG', quality=85)
                print(f"Resized: {path}")
            except Exception as e:
                print(f"Failed to process {path}: {e}")
