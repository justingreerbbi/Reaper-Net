import os
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling

def convert_to_epsg_3857(input_file, output_file):
    with rasterio.open(input_file) as src:
        if src.crs.to_string() == 'EPSG:3857':
            print(f"Skipping {input_file} as it is already in EPSG:3857.")
            return False

        transform, width, height = calculate_default_transform(
            src.crs, 'EPSG:3857', src.width, src.height, *src.bounds)
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': 'EPSG:3857',
            'transform': transform,
            'width': width,
            'height': height
        })

        with rasterio.open(output_file, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs='EPSG:3857',
                    resampling=Resampling.nearest)
    return True

def main():
    input_directory = os.getcwd() + "/geotiff"
    print(f"Input directory: {input_directory}")
    print("Converting all .tif files in the directory to EPSG:3857...")
    for file_name in os.listdir(input_directory):
        if file_name.endswith('.tif'):
            input_path = os.path.join(input_directory, file_name)
            output_path = os.path.join(input_directory, f"3857_{file_name}")
            print(f"Processing {file_name}...")
            if convert_to_epsg_3857(input_path, output_path):
                print(f"Saved converted file as {output_path}")
                os.remove(input_path)
                print(f"Removed original file {input_path}")

if __name__ == "__main__":
    main()