# Reaper Net

Reaper Net is a self-hosted, offline-first mapping application designed for field operations, mobile command setups, and environments where internet access is limited or unavailable. It provides a cross-platform map interface that can operate on its own as a local mapping tool, while also supporting optional hardware integrations such as Reaper Nodes for messaging and team tracking.

The project is still in active development, but the current foundation already supports offline maps, marker workflows, and integration points for communication and device-based location tracking.

> A Reaper Node must be connected before launching Reaper Net if you want to use messaging or node tracking features.

![Reaper Net Screenshot](https://github.com/justingreerbbi/Reaper-Net/blob/main/assets/images/screenshot-1.png)

## Overview

Reaper Net is built for users who need a local, self-hosted mapping system that can be extended with communications, GPS, and additional field tools. The project is intended to remain as cross-platform as possible and is evolving into a broader ecosystem for offline mapping, local coordination, and hardware-assisted situational awareness.

At its core, Reaper Net can function as a standalone map viewer. With the backend and supported hardware connected, it expands into a richer platform for team coordination, marker management, device tracking, and message exchange.

## Who This Is For

Reaper Net is designed for users who need local mapping and coordination tools without depending on cloud services. It is especially well suited for:

- Mobile or stationary command center setups
- Off-road teams and convoy coordination
- Field teams that need local mapping and text communication
- Self-hosted environments where privacy and control matter
- Experimental off-grid mapping and communications workflows

The project is not yet production-ready, but it already demonstrates the direction and core capabilities of the system.

## Current Features

- Offline map support
- Group text messaging through supported node hardware
- Direct text messaging
- Team member and node tracking
- Plugin-based extensibility through the core API
- AES-256 encrypted communications
- GeoTIFF overlay support for historical and reference maps
- Cross-platform development approach

## Architecture Direction

Reaper Net is being developed as a core platform with optional add-ons and integrations. The long-term goal is to separate core mapping capabilities from optional plugins and hardware modules, making it easier to extend, maintain, and package across multiple deployment targets.

Areas such as node communication, GPS, overlays, tracking, and future signal-intelligence-related tooling are intended to fit into that broader modular structure over time.

## GeoTIFF Overlay Support

Reaper Net supports uploading, converting, and applying GeoTIFF overlays.

GeoTIFF files should use the `EPSG:3857` projection. Other projections may be usable, but automatic conversion may require additional server-side tooling. Native browser-based conversion may be added in a future release.

### What Is a GeoTIFF?

A GeoTIFF is an image file that contains embedded geographic metadata. This allows mapping software to place the image accurately on the map with the correct scale and alignment.

In Reaper Net, GeoTIFF overlays can be used for historical maps, scanned field maps, and other georeferenced reference materials.

### GeoTIFF Sources

- [USGS TopoView](https://ngmdb.usgs.gov/topoview/viewer/) - Free historical topographic maps
- [David Rumsey Map Collection](https://www.davidrumsey.com/) - Historical maps and imagery

## Installation

For development, Python 3.13.2 or newer is recommended. Prepackaged releases are intended to simplify installation for end users when available.

### Clone the Repository

```bash
git clone https://github.com/justingreerbbi/Reaper-Net.git
```

### Change into the Project Directory

```bash
cd Reaper-Net
```

### Install Dependencies

```bash
pip install pyserial flask flask-socketio
```

## Running the Application

Reaper Net can function as a basic map viewer without the backend, but features such as marker persistence, GPS integration, node communication, and tracking require the backend to be running.

Start the backend with:

```bash
python start.py
```

## Reaper Node Integration

Reaper Net supports Reaper Nodes, which are custom devices running the Reaper Mesh firmware on Heltec V3 hardware.

Reaper Mesh firmware:
[Reaper Mesh](https://github.com/justingreerbbi/Reaper-Mesh)

When a supported node is connected by USB before startup, Reaper Net can detect it and enable node-based communication and tracking features.

### Current Behavior

- One frequency is currently supported
- LoRa settings are preconfigured
- Messages are broadcast to nearby compatible nodes

### Planned Improvements

- Custom encryption keys and key management
- Additional messaging improvements
- Channel scanning
- Expanded node and network controls

Reaper Net currently uses a custom communication approach for privacy, control, and tight integration with the rest of the platform.

## Supported Reaper Node Commands

```text
AT+DEVICE?
AT+MSG=YOUR MESSAGE HERE
AT+DMSG=7065|Hello Node 7065. How are you today?
AT+BEACON
AT+GPS?
```

## Nina the Reaper Hardware

“Nina the Reaper” is an ESP32 MicroMod-based hardware concept that includes LTE, Wi-Fi, BLE, and GPS support.

While functional, this design is relatively expensive, which makes it less practical for large-scale LTE-connected deployments. Future hardware work is expected to focus on reducing cost and improving integration, including possible designs that combine node communication features into a more efficient custom board.

### Supported Nina Commands

- `NR -> OK` - Device is ready
- `NR+GPS -> NR+GPS=LAT:<lat>,LNG:<lng>` or `NR+GPS=NOFIX`
- `NR+BATT` - Battery voltage
- `NR+RSSI` - Signal strength
- `NR+INFO` - Modem information

## Development Priorities

The following items are planned or under consideration:

- Location history for Reaper Nodes
- ADS-B support with aircraft classification and descriptions
- Improved marker icon support
- Continued migration of Reaper Node features to the core API and hooks
- Clear separation of core platform features and plugin functionality
- Better packaging for Windows, macOS, and Raspberry Pi deployments

Reference material for ADS-B work:
[ADS-B Decoding Guide](https://airmetar.main.jp/radio/ADS-B%20Decoding%20Guide.pdf)

## Contributing

Contributions are welcome.

To contribute:

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add feature-name"
```

4. Push your branch

```bash
git push origin feature-name
```

5. Open a pull request

For larger changes, opening an issue first is recommended so the approach can be discussed before implementation.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
