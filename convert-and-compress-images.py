import os
from PIL import Image
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

def is_png_file(filename):
    return filename.lower().endswith(".png")

def convert_png_to_jpg(input_output_pair, quality=50):
    input_path, output_path = input_output_pair
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with Image.open(input_path) as img:
            img = img.convert("RGB")  # Remove transparency
            img.save(output_path, format="JPEG", quality=quality, optimize=True)
    except Exception as e:
        print(f"⚠️ Failed to convert {input_path}: {e}")

def convert_directory(input_dir, output_dir, quality=50, max_workers=8):
    png_files = []

    for root, _, files in os.walk(input_dir):
        for file in files:
            if is_png_file(file):
                input_path = os.path.join(root, file)
                rel_path = os.path.relpath(input_path, input_dir)
                rel_path_jpg = os.path.splitext(rel_path)[0] + ".jpg"
                output_path = os.path.join(output_dir, rel_path_jpg)
                png_files.append((input_path, output_path))

    print(f"Found {len(png_files)} PNG files to convert.\n")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(convert_png_to_jpg, pair, quality): pair for pair in png_files}
        for _ in tqdm(as_completed(futures), total=len(futures), desc="Converting to JPG"):
            pass  # Just wait on each future, tqdm shows progress

if __name__ == "__main__":
    input_dir = os.path.abspath("./tiles/arcgis")              
    output_dir = os.path.abspath("./tiles/arcgis-compressed") 

    print(f"Input Directory: {input_dir}")
    print(f"Output Directory: {output_dir}")

    convert_directory(input_dir, output_dir, quality=50, max_workers=os.cpu_count())
