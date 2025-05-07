import os
import cv2
import numpy as np
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

def is_png_file(filename):
    return filename.lower().endswith(".png")

def convert_png_to_jpg_gpu(input_output_pair):
    input_path, output_path = input_output_pair
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)

        if img is None:
            raise Exception("Could not load image.")

        # Convert to RGB if PNG has alpha
        if img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        # Optionally upload to GPU and back (real benefit if doing more processing)
        # gpu_img = cv2.cuda_GpuMat()
        # gpu_img.upload(img)
        # img = gpu_img.download()

        cv2.imwrite(output_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
    except Exception as e:
        print(f"⚠️ Failed to convert {input_path}: {e}")

def convert_directory(input_dir, output_dir, max_workers=8):
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
        futures = {executor.submit(convert_png_to_jpg_gpu, pair): pair for pair in png_files}
        for _ in tqdm(as_completed(futures), total=len(futures), desc="Converting with GPU"):
            pass

if __name__ == "__main__":
    input_dir = os.path.abspath("./tiles/arcgis")              
    output_dir = os.path.abspath("./tiles/arcgis-compressed") 
    convert_directory(input_dir, output_dir, max_workers=15)
