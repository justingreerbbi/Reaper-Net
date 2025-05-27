import os
import time
import socket
import serial
import threading
import webbrowser
import csv
import requests
import serial.tools.list_ports
from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO
import subprocess

# === Flask + SocketIO setup ===
app = Flask(__name__, static_folder='.', static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# === Reaper Node Serial State ===
reaper_node_serial = None
reaper_node_connected = False
connected_reaper_node_port = None
connected_reaper_node_name = None
aircraft_srd_connected = False

development_mode = True  # Set to True for development mode

REAPER_NODE_DETECTION_TIMEOUT = 4

# === Aircraft Tracking ===
aircraft_data = {}
SBS1_FIELDS = [
    "message_type", "transmission_type", "session_id", "aircraft_id",
    "hex_ident", "flight_id", "generated_date", "generated_time",
    "logged_date", "logged_time", "callsign", "altitude", "ground_speed",
    "track", "lat", "lon", "vertical_rate", "squawk",
    "alert", "emergency", "spi", "is_on_ground"
]

CSV_FILE = 'aircraft_log.csv'
CSV_FIELDS = [
    "icao", "callsign", "altitude", "lat", "lon", "type", "military", "last_seen",
    "icao_type", "manufacturer", "owner", "registered_owner_country_iso_name",
    "registered_owner_operator_flag_code", "adsbdb_last_checked"
]

# === Utility: Check Internet ===
def check_internet():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3)
        return True
    except OSError:
        return False

# === CSV Handling ===
def load_aircraft_from_csv():
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                aircraft_data[row["icao"]] = row

def save_aircraft_to_csv(icao, data):
    updated = False
    rows = []

    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, newline='') as csvfile:
            rows = list(csv.DictReader(csvfile))

    for row in rows:
        if row["icao"] == icao:
            for key, value in data.items():
                if value:  # only update if new value is non-empty
                    row[key] = value
            updated = True
            break

    if not updated:
        # Fill in all missing fields so CSV stays consistent
        full_data = {field: data.get(field, "") for field in CSV_FIELDS}
        rows.append(full_data)

    with open(CSV_FILE, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


# === ICAO Aircraft Metadata API (for quick lookup during ingestion)
def lookup_aircraft_info(icao):
    try:
        url = f"https://opensky-network.org/api/metadata/icao/{icao}"
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return {
                "type": data.get("aircraftType", "Unknown"),
                "military": "Yes" if data.get("operator", "").lower() in ["usaf", "us navy", "raf", "military"] else "No"
            }
    except Exception as e:
        print(f"[!] Lookup failed for {icao}: {e}")
    return {"type": "Unknown", "military": "Unknown"}

# === Background: Enrich CSV with ADSBdb data
def enrich_aircraft_data():
    while True:
        if not os.path.exists(CSV_FILE):
            time.sleep(120)
            continue

        updated_rows = []
        changed = False
        now_str = time.strftime("%Y-%m-%d %H:%M:%S")

        with open(CSV_FILE, newline='') as csvfile:
            rows = list(csv.DictReader(csvfile))

        for row in rows:
            if row.get("adsbdb_last_checked"):
                updated_rows.append(row)
                continue

            icao = row["icao"]
            try:
                url = f"https://api.adsbdb.com/v0/aircraft/{icao}"
                r = requests.get(url, timeout=5)
                if r.status_code == 200:
                    result = r.json()
                    aircraft = result.get("response", {}).get("aircraft", {})

                    if aircraft:
                        row["icao_type"] = aircraft.get("icao_type", "")
                        row["manufacturer"] = aircraft.get("manufacturer", "")
                        row["owner"] = aircraft.get("registered_owner", "")
                        row["registered_owner_country_iso_name"] = aircraft.get("registered_owner_country_iso_name", "")
                        row["registered_owner_operator_flag_code"] = aircraft.get("registered_owner_operator_flag_code", "")
                        row["adsbdb_last_checked"] = now_str
                        changed = True
            except Exception as e:
                print(f"[!] ADSBdb lookup failed for {icao}: {e}")
            updated_rows.append(row)

        if changed:
            with open(CSV_FILE, 'w', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS)
                writer.writeheader()
                writer.writerows(updated_rows)

        time.sleep(120)

# === Detect and Connect to Reaper Node ===
def auto_find_reaper_mesh_node():
    print("Scanning for Reaper Mesh Node...")
    devices = {}
    for port in serial.tools.list_ports.comports():
        if any(skip in port.device for skip in ['Bluetooth', 'debug']):
            continue
        try:
            with serial.Serial(port.device, 115200, timeout=REAPER_NODE_DETECTION_TIMEOUT) as ser:
                ser.flushInput()
                time.sleep(0.5)
                ser.write(b'AT+DEVICE?\r\n')
                start_time = time.time()
                while time.time() - start_time < REAPER_NODE_DETECTION_TIMEOUT:
                    if ser.in_waiting:
                        line = ser.readline().decode(errors='ignore').strip()
                        if line.startswith("HELTEC|READY|"):
                            label = line.split("|")[2]
                            devices[port.device] = label
                            break
        except (serial.SerialException, OSError) as e:
            print(f"Failed to open {port.device}: {e}")
    return devices

# === Serial Reader ===
def serial_reader_thread(ser):
    while True:
        try:
            if ser.in_waiting:
                line = ser.readline().decode(errors='ignore').strip()
                if line:
                    print("[Reaper Node]", line)
                    socketio.emit('reaper_node_received', {'line': line})
        except Exception as e:
            print("Serial read error:", e)
            break
        time.sleep(0.05)

# === SBS1 Listener ===
def parse_sbs1_line(line):
    parts = line.strip().split(',')
    if len(parts) < 22:
        return None
    return dict(zip(SBS1_FIELDS, parts))

def sbs1_listener(host='127.0.0.1', port=30003):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((host, port))
            print(f"[*] Connected to dump1090 on {host}:{port}")
            global aircraft_srd_connected
            aircraft_srd_connected = True
            while True:
                data = sock.recv(4096)
                if not data:
                    break
                lines = data.decode(errors='ignore').splitlines()
                for line in lines:
                    parsed = parse_sbs1_line(line)
                    if parsed and parsed.get("hex_ident"):
                        icao = parsed["hex_ident"]
                        ac = aircraft_data.setdefault(icao, {})
                        ac.update({k: v for k, v in parsed.items() if v})
                        ac["last_seen"] = time.strftime("%Y-%m-%d %H:%M:%S")

                        if "type" not in ac:
                            info = lookup_aircraft_info(icao)
                            ac["type"] = info["type"]
                            ac["military"] = info["military"]

                        csv_row = {
                            "icao": icao,
                            "callsign": ac.get("callsign", ""),
                            "altitude": ac.get("altitude", ""),
                            "lat": ac.get("lat", ""),
                            "lon": ac.get("lon", ""),
                            "type": ac.get("type", "Unknown"),
                            "military": ac.get("military", "Unknown"),
                            "last_seen": ac["last_seen"],
                            "icao_type": ac.get("icao_type", ""),
                            "manufacturer": ac.get("manufacturer", ""),
                            "owner": ac.get("owner", ""),
                            "registered_owner_country_iso_name": ac.get("registered_owner_country_iso_name", ""),
                            "registered_owner_operator_flag_code": ac.get("registered_owner_operator_flag_code", ""),
                            "adsbdb_last_checked": ac.get("adsbdb_last_checked", "")
                        }
                        save_aircraft_to_csv(icao, csv_row)
    except Exception as e:
        print(f"[!] SBS1 error: {e}")

# === Flask Routes ===
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/status')
def api_status():
    return jsonify({
        "internet_connected": check_internet(),
        "reaper_node_connected": reaper_node_connected,
        "aircraft_tracker_connected": aircraft_srd_connected,
        "reaper_node_name": connected_reaper_node_name,
        "reaper_node_port": connected_reaper_node_port,
        "backend_version": "1.4.1",
        "frontend_version": "1.7.76",
        "system_time": time.strftime("%Y-%m-%d %H:%M:%S"),
    })

@app.route('/api/plugins')
def list_plugins():
    plugins_dir = os.path.join(app.root_path, 'plugins')
    plugin_files = [f for f in os.listdir(plugins_dir) if f.endswith('.js')]
    return jsonify([os.path.splitext(p)[0] for p in plugin_files])

@app.route('/api/aircraft')
def get_aircraft():
    cutoff = time.time() - 60
    filtered = {}
    for icao, ac in aircraft_data.items():
        last_seen = ac.get("last_seen")
        if last_seen:
            try:
                ts = time.mktime(time.strptime(last_seen, "%Y-%m-%d %H:%M:%S"))
                if ts >= cutoff:
                    filtered[icao] = ac
            except Exception:
                continue
    return jsonify(filtered)

@socketio.on('send_reaper_node_command')
def handle_send_command(data):
    print(f"[RECEIVED] {data}")
    command = data.get('command', '').strip()
    if reaper_node_serial and command:
        print(f"[SEND] {command}")
        reaper_node_serial.write(f"{command}\n".encode())

# === Start Server ===
def start_server():
    socketio.run(app, port=1776)

# === Main Entry ===
if __name__ == '__main__':
    print("")
    print("=========================================")
    print(" Reaper Net - Serial Web Bridge v1.0")
    print("=========================================\n")

    load_aircraft_from_csv()

    devices = auto_find_reaper_mesh_node()
    if devices:
        port, name = next(iter(devices.items()))
        connected_reaper_node_port = port
        connected_reaper_node_name = name
        reaper_node_serial = serial.Serial(port, 115200, timeout=2)
        reaper_node_connected = True
        print(f"Connected to Reaper Node at {port} ({name})")
        threading.Thread(target=serial_reader_thread, args=(reaper_node_serial,), daemon=True).start()
    else:
        print("No Reaper Mesh Node detected.")

    threading.Thread(target=start_server, daemon=True).start()
    threading.Thread(target=sbs1_listener, daemon=True).start()

    if(development_mode):
        threading.Thread(target=enrich_aircraft_data, daemon=True).start()

    webbrowser.open("http://localhost:1776")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
