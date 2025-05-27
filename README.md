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

-   Location history for reaper nodes.
-   Finish migrating reaper-node functions to use core API and hooks instead of direct integration.
-   Start really honing on on structure, API, and exported hooks. Determine what is core and what is a plugin.
-   Build packer for the app for windows, OSX, and Raspberry. While the system will be already installed on the product, for public, this is the best case.

## Features

-   Offline maps.
-   Group Text Messaging.
-   Direct Text Messages.
-   Extendable by plugins using the core API.
-   AES256 Encryption.
-   Team Member Tracking.

### Reaper Node v1.0

Reaper Net supports global and direct messaging as well as beacons to update locations.

**ToDos**

-   Update last seen to hours, days, weeks...
-   Ability to send marker data to single person or global group.
-   Request beacon feature?

### Aircraft Tracker v1.0

Reaper Net supports dump1090 on default settings. The current version supports dump1090 integration and aircraft markers on the map along with basic information Future plans include adding in filtering, searching, history data, and the ability to customize specific aircraft.

**ToDos**

-   Add in aircraft ICAO lookup to start building known aircraft. This is more for development and DD Building.
-   Add history for aircraft on screen. Selecting will show history of aircraft while in the AO.
-   Add setting to include purge time, DB builder, toggle aircraft, filter, ICAO search, alert on new aircraft/purged aircraft.

### Long Range 2.4Ghz Data Transmission v1.0

Reaper Net supports nRF24L01 module for data transmission. Currently this is very early in firmware development but proof of concept was successful in recent tests,

## GeoTIFF Overlay

Reaper Net supports uploading, converting, and applying GeoTIFF files. GeoTIFF files **must** use projection EPSG:3857. While other projections can be used, automatic conversion requires additional server setup. Native in-browser conversion is under consideration.

Sources for GeoTIFFs:

-   [USGS TopoView](https://ngmdb.usgs.gov/topoview/viewer/) - Free historic maps
-   [David Rumsey Map Collection](https://www.davidrumsey.com/) - Historical imagery

### What Are GeoTIFF Files?

GeoTIFF files are scanned historic maps enhanced with embedded metadata, allowing mapping software to correctly place them with proper scale. These are not standard image files and contain spatial metadata specific to systems like Reaper Net.

## Installation

You should have at least Python 3.13.2 for development Releases are prepackaged and ready to go.

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
    pip install pyserial flask flask-socketio
    ```

## Usage

Reaper Net works as a basic map viewer without the backend. To save markers, use GPS, or communicate with a Reaper Node, start the backend:

```bash
python start.py
```

### Reaper Node

Reaper Node Firmware: [Reaper Mesh](https://github.com/justingreerbbi/Reaper-Mesh).

This application supports Reaper Nodes (custom firmware on Heltec V3) via USB. When plugged in and the app is started, the node is auto-detected, and encrypted communication is enabled.

Currently:

-   Only one frequency is supported
-   LoRa settings are optimized
-   All messages are broadcast to nearby nodes

Planned improvements:

-   Custom encryption keys/methods
-   Direct messaging
-   Channel scanning
-   Potential Meshtastic compatibility

This project favors custom communication protocols to ensure privacy and reliability.

### Supported Node Commands

```text
AT+DEVICE?
AT+MSG=YOUR MESSAGE HERE
AT+DMSG=7065|Hello Node 7065. How are you today?
AT+BEACON
AT+GPS?
```

### Nina The Reaper Hardware

"Nina the Reaper" is an ESP32 MicroMod-based device with LTE, Wi-Fi, BLE, and GPS. While functional, it is costly (a few hundred dollars), making it impractical for LTE connectivity at scale.

Plans are underway to design a custom board integrating the LoRa node to reduce cost.

Supported commands:

-   `NR -> OK` – Device is ready
-   `NR+GPS -> NR+GPS=LAT:<lat>,LNG:<lng>` or `NR+GPS=NOFIX`
-   `NR+BATT` – Battery voltage
-   `NR+RSSI` – Signal strength
-   `NR+INFO` – Modem information

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
