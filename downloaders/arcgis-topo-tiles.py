import os
import requests
from math import log, tan, pi, cos
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import time

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = lat_deg * pi / 180
    n = 2.0 ** zoom
    x_tile = int((lon_deg + 180.0) / 360.0 * n)
    y_tile = int((1.0 - log(tan(lat_rad) + 1 / cos(lat_rad)) / pi) / 2.0 * n)
    return x_tile, y_tile

def fetch_tile(z, x, y, url_template, save_dir, api_key, headers, max_retries=3):
    url = url_template.format(z=z, x=x, y=y, key=api_key)
    path = f"{save_dir}/{z}/{x}/{y}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if os.path.exists(path):
        return True  # Already downloaded

    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                with open(path, 'wb') as f:
                    f.write(response.content)
                return True
            else:
                print(f"⚠️ Failed ({response.status_code}): {url}")
        except Exception as e:
            print(f"❌ Error fetching {url} (attempt {attempt + 1}): {e}")
        time.sleep(2 ** attempt)  # exponential backoff

    return False  # All retries failed

def download_tiles(zoom_levels, lat_min, lat_max, lon_min, lon_max, url_template, save_dir, api_key, thread_count=10):
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; TileScraper/1.0; +https://yourdomain.com)'
    }

    tile_tasks = []

    for z in zoom_levels:
        x_start, y_start = deg2num(lat_max, lon_min, z)
        x_end, y_end = deg2num(lat_min, lon_max, z)
        for x in range(x_start, x_end + 1):
            for y in range(y_start, y_end + 1):
                tile_tasks.append((z, x, y))

    total = len(tile_tasks)

    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = []
        progress = tqdm(total=total, desc="Downloading tiles", unit="tile")

        for z, x, y in tile_tasks:
            future = executor.submit(fetch_tile, z, x, y, url_template, save_dir, api_key, headers)
            futures.append(future)

        for future in as_completed(futures):
            future.result()  # This will raise errors if fetch_tile failed critically
            progress.update(1)

        progress.close()

# Define bounding box for United States
lat_min = 24.396308
lat_max = 49.384358
lon_min = -125.0
lon_max = -66.93457

# Placeholder API key (not used with ArcGIS URL, but kept for Thunderforest compatibility)
api_key = "YOUR_API_KEY"

# Start download
download_tiles(
    zoom_levels=range(13, 15),
    lat_min=lat_min,
    lat_max=lat_max,
    lon_min=lon_min,
    lon_max=lon_max,
    url_template="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    save_dir="./tiles/arcgis/topo",
    api_key=api_key,
    thread_count=15
)
