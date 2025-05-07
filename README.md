# Reaper Net

Reaper Net is an offline mapping system. Add-ons like node communication, GPS, etc can be added to the system for a more robust system.

Reaper Net is developed to be entirely self hosted. This ensures secure and reliability of the system. It also adds the benefits
of making it extremely fast.

This project is quickly growing into it own suite where I see the possibility to tie into off-grid tactical solutions. So far it is showing potential
to allow complete off-grid mapping with the ability to be tied into digital communications and SigOSINT. ADS, Meshtastic, LoraWan, GPS, node tracking,
and much more! This project is pretty cross-platform as of now and will continue to be if I can help it.

## Todos

-   Add ADS support.
-   Add Meshtastic Support.
-   Add support for Ham Digital Radio both traditional and not traditional encrypted communication.

## Features

-   Offline Maps
-   Support for add-ons like node communication and GPS
-   Customizable and extensible system
-   GeoTiff Overlay Support

# GeoTiff Overlay

Reaper Net supports uploading, converting, and applying GeoTiff files. GeoTiff files MUST use projection EPSG:3857.
The software does support automatically converting other GeoTiff file but does require some additional server setup.
For now this is the only way but I am looking at ways to convert natively in the browser.

-   GeoTiff's can be found and downloaded at https://ngmdb.usgs.gov/topoview/viewer/. This site contains every map every made for free.
-   https://www.davidrumsey.com/ is a good source just for imagery as well.

**What are GeoTiff Files**

GeoTiff files are historic maps printed but have been scanned and metadata as been added to them so that mapping software knows where to place them
along with there scale. These not not normal images in the sense of images. They contain metadata specific read my Reaper Net.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/reaper-net.git
    ```
2. Navigate to the project directory:
    ```bash
    cd reaper-net
    ```
3. Install dependencies:
    ```bash
    npm install
    ```

## Usage

### Nine The Reaper

The ESP32 MicroMod firmware can be connected to via serial (USB) for native connection. Support is limited but it does currently support basic
commands.

NR -> OK - The device is booted and ready.
NR+GPS -> NR+GPS=LAT:<lat>,LNG:<lng> or NR+GPS=NOFIX
NR+BATT -> Voltage
NR+RSSI -> Signal RSSI
NR+INFO -> Device modem information

1. Start the application:
    ```bash
    npm start
    ```
2. Open your browser and navigate to `http://localhost:3000`.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch:
    ```bash
    git checkout -b feature-name
    ```
3. Commit your changes:
    ```bash
    git commit -m "Add feature-name"
    ```
4. Push to your branch:
    ```bash
    git push origin feature-name
    ```
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please contact [your-email@example.com].
