import os
from PIL import Image
from tqdm import tqdm

def is_png_file(filename):
    return filename.lower().endswith(".png")

def convert_png_to_jpg(input_path, output_path, quality=50):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        with Image.open(input_path) as img:
            # Convert image to RGB to drop alpha/transparency
            rgb_img = img.convert("RGB")
            rgb_img.save(output_path, format="JPEG", quality=quality, optimize=True)
    except Exception as e:
        print(f"⚠️ Failed to convert {input_path}: {e}")

def convert_directory(input_dir, output_dir, quality=50):
    image_files = []

    for root, _, files in os.walk(input_dir):
        for file in files:
            if is_png_file(file):
                input_path = os.path.join(root, file)
                rel_path = os.path.relpath(input_path, input_dir)
                rel_path_jpg = os.path.splitext(rel_path)[0] + ".jpg"
                output_path = os.path.join(output_dir, rel_path_jpg)
                image_files.append((input_path, output_path))

    print(f"Found {len(image_files)} PNG files to convert.\n")

    for input_path, output_path in tqdm(image_files, desc="Converting to JPG"):
        convert_png_to_jpg(input_path, output_path, quality)

if __name__ == "__main__":
    input_dir = r".\org"               # 👈 Set your source folder
    output_dir = r".\org-compressed"   # 👈 Set your output folder

    convert_directory(input_dir, output_dir, quality=50)
