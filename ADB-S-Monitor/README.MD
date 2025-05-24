# ADB-S Monitor

ADB-S Monitor is a tool designed to monitor and manage aircraft that are transmitting frequencies overhead.

## Understanding DF Codes (Downlink Format)

In Mode S and ADS-B communication, each packet contains a **Downlink Format (DF)** field — a 5-bit value that identifies the message type being transmitted by the aircraft.

Below is a breakdown of the most common DF codes and their meanings:

| DF Code | Name                            | Description                                                                 |
|---------|----------------------------------|-----------------------------------------------------------------------------|
| 0–4     | Short Surveillance Replies       | Legacy SSR radar-related responses                                          |
| 5       | Surveillance ID Reply            | Contains squawk (transponder) code                                          |
| 11      | All-Call Reply                   | Broadcast of ICAO address (used during Mode S interrogations)              |
| 16      | Long Surveillance Reply          | Rare; typically used in radar systems                                       |
| **17**  | **ADS-B Extended Squitter**      | Primary ADS-B messages: position, altitude, velocity, callsign              |
| 18      | ADS-B via UAT                    | Used in 978 MHz band (not applicable on 1090 MHz)                           |
| 19      | Extended Squitter (non-position) | Used for velocity, aircraft category, or status                             |
| 20–22   | Comm-B Replies                   | Contain BDS (Broadcast Datalink Subset) data like TCAS or intent            |
| 24      | Comm-D Extended Reply            | Rare; used for extended communication data                                  |
| 25–31   | Reserved or Undefined            | Reserved for future use or may indicate corrupted or malformed messages     |

> ⚠️ **This decoder focuses exclusively on DF=17 messages (ADS-B Extended Squitter)**  
> These are the most valuable packets, containing:
> - ICAO address  
> - Callsign  
> - Altitude  
> - Velocity and heading  
> - Position (latitude and longitude via CPR decoding)

All other DF types are ignored by default unless specifically enabled or supported.

## 📡 Reaper Net - Tactical SIGINT Targets & Triggers

Reaper Net is designed for modular signal intelligence (SIGINT) in the field. In addition to ADS-B decoding, the system can be extended to monitor and react to a wide variety of radio signals. This document outlines useful signal targets, detection methods, and actionable triggers.

---

### ✈️ 1. Aircraft & Drone Detection

| Signal Type             | Frequency         | Purpose                                     |
|-------------------------|-------------------|---------------------------------------------|
| **ADS-B**               | 1090 MHz          | Detect & track commercial aircraft          |
| **UAT**                 | 978 MHz           | Detect general aviation (U.S.) aircraft     |
| **Drone C2 Links**      | 2.4 / 5.8 GHz     | Detect DJI/FCC drone command links          |
| **Telemetry Downlinks** | 1.2–1.3 GHz       | Identify drone sensor data channels         |
| **Helicopter Beacons**  | VHF/UHF           | Law enforcement or surveillance helicopters |

#### 🔧 Triggers:
- Low-altitude aircraft within proximity
- New drones or telemetry channels active

---

### 📱 2. Cellular Intelligence

| Signal Type      | Frequency             | Purpose                          |
|------------------|-----------------------|----------------------------------|
| **GSM Towers**   | 850/900/1800/1900 MHz | Log ARFCNs and Cell IDs          |
| **LTE Broadcast**| 700–2600 MHz          | Decode eNodeB IDs and bands      |
| **IMSI Catchers**| Various               | Detect rogue/fake base stations  |

#### 🔧 Triggers:
- Unknown LTE tower detected
- Abnormal tower power or no MCC/MNC
- Suspected IMSI-catcher pattern

---

### 📻 3. Local RF Devices

| Signal Type         | Frequency           | Purpose                              |
|---------------------|---------------------|--------------------------------------|
| **LoRa**            | 433 / 868 / 915 MHz | Detect mesh nodes like Meshtastic    |
| **MURS**            | 151–154 MHz         | Detect wildlife trackers / handhelds |
| **GMRS/FRS**        | 462–467 MHz         | Detect field comms                   |
| **Custom RF Pulse** | Any                 | Trigger on digital burst detection   |

#### 🔧 Triggers:
- Unknown LoRa or GMRS node nearby
- New unclassified RF burst detected

---

### 🚓 4. Law Enforcement / Military Comms

| Signal Type           | Frequency     | Purpose                            |
|-----------------------|---------------|------------------------------------|
| **P25 Digital Voice** | 700–900 MHz   | Law enforcement channels           |
| **TETRA**             | 380–400 MHz   | Military / public safety (EU/INT)  |
| **MILSAT / SATCOM**   | 243, 292 MHz+ | Detect military satellite activity |

#### 🔧 Triggers:
- P25 activity detected
- Encrypted group or tactical comms observed

---

### 🛰️ 5. Satellite & IoT Systems

| Signal Type      | Frequency                 | Purpose                          |
|----------------------|-----------------------|----------------------------------|
| **Iridium**          | 1616–1626 MHz         | Satphone & global IoT bursts     |
| **AIS (Marine)**     | 162.025 / 162.025 MHz | Ship and vessel location data    |
| **Starlink Leakage** | 10.7–12.7 GHz         | Detect unintentional emissions   |

#### 🔧 Triggers:
- Iridium burst detected (may indicate satphone)
- AIS vessel signal near coastal ops zone

---

### 🧭 6. BLE, Wi-Fi, & Device Surveillance

| Signal Type      | Frequency          | Purpose                                 |
|------------------|--------------------|-----------------------------------------|
| **BLE Beacons**  | 2.4 GHz            | Detect AirTags, Tile, smart tags        |
| **Wi-Fi Probes** | 2.4 / 5 GHz        | Detect rogue or new access points       |
| **Zigbee**       | 2.4 GHz            | Monitor mesh smart home/device networks |

#### 🔧 Triggers:
- New BLE tracker detected near user/device
- Unexpected Wi-Fi or mesh device activity

---

### 🔍 Suggested Tools for Integration

| Tool | Use Case |
|------|----------|
| `hackrf_sweep` | Frequency scanning and heatmaps |
| `gr-gsm`, `kalibrate` | GSM/ARFCN scanning |
| `srsRAN`, `LTE-Cell-Scanner` | LTE broadcast + tower info |
| `gr-lora`, `LoRaTap` | LoRa detection |
| `rtl_433` | Generic RF sensor decoding (weather, remotes) |
| `DSD+`, `OP25`, `sdrtrunk` | P25/TETRA digital voice decoding |

---

### 🚨 Example Reaper Net Triggers

- `New LoRa node on 915 MHz → Map alert & log`
- `Drone command frequency burst on 2.4 GHz → Tactical alert`
- `Unknown LTE eNodeB ID in area → Stingray warning`
- `Iridium burst detected → Possible satphone use`
- `BLE tracker (AirTag/Tile) detected → Anti-tracking warning`

---

**Why use subprocess and not pyhackrf?**

Because pyhackrf does not work. Thanks but no thanks.

**What is the range of this application?**

It is all based on your location and antenna. The distance will most likely be more than you would need. With this said, below are some testing results bwith the longest distance seen.

- Indoors with a crappy antenna: 9 Miles
- Same crappy antenna in a window: 30 Miles
- Roof mounted antenna 80 Miles

All examples was with no gain.

## Features

- Monitor active ADB sessions and forward them to the Reaper Net system.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/ADB-S-Monitor.git
    ```
2. Navigate to the project directory:
    ```bash
    cd ADB-S-Monitor
    ```
3. Install dependencies (if applicable).

## Usage

1. Start the tool:
    ```bash
    python main.py
    ```
2. Follow the on-screen instructions to monitor and manage ADB sessions.

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

This project is licensed under the [MIT License](LICENSE).

## Contact

For questions or feedback, please contact [your-email@example.com].