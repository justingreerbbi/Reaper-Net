# Reaper Net

**IN DEVELOPMENT**

Reaper Net is an offline mapping system. Add-ons like node communication, GPS, and more can be added to create a more robust system. Reaper Net is designed to be entirely self-hosted.

This project is quickly evolving into a suite that I envision being useful for off-grid tactical solutions. It shows potential for complete off-grid mapping with the ability to pair with text messaging via LoRa and other SIGINT tools. It is currently cross-platform and will remain so as much as possible.

> ⚠️ A Reaper Node **must** be plugged in before starting Reaper Net if you want to use messaging and node tracking.

![Reaper Net Screenshot](https://github.com/justingreerbbi/Reaper-Net/blob/main/assets/images/screenshot-1.png)

## Who Is This For?

Reaper Net can be used in multiple scenarios. If you want to set up a command center, either stationary or mobile, this project is for you. It is a great solution for off-road teams. Team leaders can use this application to see where all vehicles are and send text messages to them.

While the project is not production-ready yet, it offers a glimpse into its capabilities.

## Todos

* Investigate CesiumJS for 3D mapping
* Consider integrating [Leaflet.Elevation](https://github.com/MrMufflon/Leaflet.Elevation)
* Explore WMTS overlays such as:

  * `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/250m/{z}/{y}/{x}.jpg`

## Features

* Offline maps
* Add-on support: node communication, GPS
* Customizable and extensible
* GeoTIFF overlay support

## GeoTIFF Overlay

Reaper Net supports uploading, converting, and applying GeoTIFF files. GeoTIFF files **must** use projection EPSG:3857. While other projections can be used, automatic conversion requires additional server setup. Native in-browser conversion is under consideration.

Sources for GeoTIFFs:

* [USGS TopoView](https://ngmdb.usgs.gov/topoview/viewer/) - Free historic maps
* [David Rumsey Map Collection](https://www.davidrumsey.com/) - Historical imagery

### What Are GeoTIFF Files?

GeoTIFF files are scanned historic maps enhanced with embedded metadata, allowing mapping software to correctly place them with proper scale. These are not standard image files and contain spatial metadata specific to systems like Reaper Net.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/justingreerbbi/Reaper-Net.git
   ```
2. Navigate to the project directory:

   ```bash
   cd reaper-net
   ```
3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

## Usage

Reaper Net works as a basic map viewer without the backend. To save markers, use GPS, or communicate with a Reaper Node, start the backend:

```bash
python start.py
```

### Reaper Node

This application supports Reaper Nodes (custom firmware on Heltec V3) via USB. When plugged in and the app is started, the node is auto-detected, and encrypted communication is enabled.

Currently:

* Only one frequency is supported
* LoRa settings are optimized
* All messages are broadcast to nearby nodes

Planned improvements:

* Custom encryption keys/methods
* Direct messaging
* Channel scanning
* Potential Meshtastic compatibility

This project favors custom communication protocols to ensure privacy and reliability.

### Nina The Reaper Hardware

"Nina the Reaper" is an ESP32 MicroMod-based device with LTE, Wi-Fi, BLE, and GPS. While functional, it is costly (a few hundred dollars), making it impractical for LTE connectivity at scale.

Plans are underway to design a custom board integrating the LoRa node to reduce cost.

Supported commands:

* `NR -> OK` – Device is ready
* `NR+GPS -> NR+GPS=LAT:<lat>,LNG:<lng>` or `NR+GPS=NOFIX`
* `NR+BATT` – Battery voltage
* `NR+RSSI` – Signal strength
* `NR+INFO` – Modem information

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch:

   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:

   ```bash
   git commit -m "Add feature-name"
   ```
4. Push your branch:

   ```bash
   git push origin feature-name
   ```
5. Open a pull request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, contact \[[your-email@example.com](mailto:your-email@example.com)].
