import os
import requests
from math import log, tan, pi, cos

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = lat_deg * pi / 180
    n = 2.0 ** zoom
    x_tile = int((lon_deg + 180.0) / 360.0 * n)
    y_tile = int((1.0 - log(tan(lat_rad) + 1 / cos(lat_rad)) / pi) / 2.0 * n)
    return x_tile, y_tile

def download_tiles(zoom_levels, lat_min, lat_max, lon_min, lon_max, url_template, save_dir):
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; TileScraper/1.0; +https://yourdomain.com)'
    }

    for z in zoom_levels:
        x_start, y_start = deg2num(lat_max, lon_min, z)
        x_end, y_end = deg2num(lat_min, lon_max, z)
        os.makedirs(f"{save_dir}/{z}", exist_ok=True)
        for x in range(x_start, x_end + 1):
            os.makedirs(f"{save_dir}/{z}/{x}", exist_ok=True)
            for y in range(y_start, y_end + 1):
                url = url_template.format(z=z, x=x, y=y)
                path = f"{save_dir}/{z}/{x}/{y}.png"
                if os.path.exists(path):
                    continue
                try:
                    r = requests.get(url, headers=headers, timeout=10)
                    if r.status_code == 200:
                        with open(path, 'wb') as f:
                            f.write(r.content)
                    else:
                        print(f"⚠️ Skipped {url} (status {r.status_code})")
                except Exception as e:
                    print(f"❌ Error fetching {url}: {e}")

# United States bounding box
lat_min = 24.396308
lat_max = 49.384358
lon_min = -125.0
lon_max = -66.93457

download_tiles(
    zoom_levels=range(11, 18),  # zooms x through 
    lat_min=lat_min,
    lat_max=lat_max,
    lon_min=lon_min,
    lon_max=lon_max,
    url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    save_dir="./usa_tiles"
)
