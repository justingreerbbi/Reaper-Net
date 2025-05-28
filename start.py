import os
import time
import socket
import serial
import threading
import webbrowser
import requests
import serial.tools.list_ports
import sqlite3
from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO
import subprocess
from datetime import datetime

# === Flask + SocketIO setup ===
app = Flask(__name__, static_folder='.', static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# === Reaper Node Serial State ===
reaper_node_serial = None
reaper_node_connected = False
connected_reaper_node_port = None
connected_reaper_node_name = None
aircraft_srd_connected = False

REAPER_NODE_DETECTION_TIMEOUT = 4

# === Aircraft Tracking ===
aircraft_data = {}
DB_FILE = 'aircraft_log.db'

# === SQLite DB Init ===
def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS aircraft (
                icao TEXT PRIMARY KEY,
                callsign TEXT,
                altitude TEXT,
                lat TEXT,
                lon TEXT,
                type TEXT,
                military TEXT,
                last_seen TEXT,
                icao_type TEXT,
                manufacturer TEXT,
                owner TEXT,
                registered_owner_country_iso_name TEXT,
                registered_owner_operator_flag_code TEXT,
                adsbdb_last_checked TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS aircraft_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                icao TEXT,
                callsign TEXT,
                altitude TEXT,
                lat TEXT,
                lon TEXT,
                type TEXT,
                military TEXT,
                last_seen TEXT,
                icao_type TEXT,
                manufacturer TEXT,
                owner TEXT,
                registered_owner_country_iso_name TEXT,
                registered_owner_operator_flag_code TEXT,
                adsbdb_last_checked TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

init_db()

# === ICAO Aircraft Metadata API ===
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

## Clean the database by removing old entries
def clean_aircraft_db():
    while True:
        with sqlite3.connect(DB_FILE) as conn:
            now = datetime.utcnow()
            print(f"[CLEANUP] Cleaning aircraft database at {now.strftime('%Y-%m-%d %H:%M:%S')}")
            cursor = conn.cursor()
            cutoff = datetime.utcnow() - timedelta(minutes=30)
            cursor.execute('''
                DELETE FROM aircraft WHERE last_seen < ?
            ''', (cutoff.strftime("%Y-%m-%d %H:%M:%S"),))
            cursor.execute('''
                DELETE FROM aircraft_history WHERE last_seen < ?
            ''', (cutoff.strftime("%Y-%m-%d %H:%M:%S"),))
            conn.commit()
        time.sleep(60 * 1)  # Clean every 30 minutes
        
# === Enrich Aircraft Data from ADSBdb ===
def enrich_aircraft_data():
    while True:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM aircraft WHERE adsbdb_last_checked IS NULL")
            rows = cursor.fetchall()

            now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            for row in rows:
                icao = row[0]
                try:
                    url = f"https://api.adsbdb.com/v0/aircraft/{icao}"
                    r = requests.get(url, timeout=5)
                    if r.status_code == 200:
                        result = r.json()
                        aircraft = result.get("response", {}).get("aircraft", {})
                        if aircraft:
                            cursor.execute('''
                                UPDATE aircraft SET
                                    icao_type = ?,
                                    manufacturer = ?,
                                    owner = ?,
                                    registered_owner_country_iso_name = ?,
                                    registered_owner_operator_flag_code = ?,
                                    adsbdb_last_checked = ?
                                WHERE icao = ?
                            ''', (
                                aircraft.get("icao_type", ""),
                                aircraft.get("manufacturer", ""),
                                aircraft.get("registered_owner", ""),
                                aircraft.get("registered_owner_country_iso_name", ""),
                                aircraft.get("registered_owner_operator_flag_code", ""),
                                now_str,
                                icao
                            ))
                except Exception as e:
                    print(f"[!] ADSBdb lookup failed for {icao}: {e}")
            conn.commit()
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
    fields = line.strip().split(',')
    if len(fields) < 22:
        return None
    return dict(zip([
        "message_type", "transmission_type", "session_id", "aircraft_id",
        "hex_ident", "flight_id", "generated_date", "generated_time",
        "logged_date", "logged_time", "callsign", "altitude", "ground_speed",
        "track", "lat", "lon", "vertical_rate", "squawk",
        "alert", "emergency", "spi", "is_on_ground"
    ], fields))

def sbs1_listener(host='127.0.0.1', port=30003):
    global aircraft_srd_connected
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((host, port))
            print(f"[*] Connected to dump1090 on {host}:{port}")
            aircraft_srd_connected = True
            while True:
                data = sock.recv(4096)
                if not data:
                    break
                lines = data.decode(errors='ignore').splitlines()
                now = datetime.utcnow()
                for line in lines:
                    parsed = parse_sbs1_line(line)
                    if parsed and parsed.get("hex_ident"):
                        icao = parsed["hex_ident"]
                        ac = aircraft_data.setdefault(icao, {})
                        ac.update({k: v for k, v in parsed.items() if v})
                        ac["last_seen"] = now.strftime("%Y-%m-%d %H:%M:%S")

                        if "type" not in ac:
                            info = lookup_aircraft_info(icao)
                            ac["type"] = info["type"]
                            ac["military"] = info["military"]

                        with sqlite3.connect(DB_FILE) as conn:
                            cursor = conn.cursor()
                            cursor.execute('''
                                INSERT INTO aircraft (icao, callsign, altitude, lat, lon, type, military, last_seen)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                ON CONFLICT(icao) DO UPDATE SET
                                    callsign=excluded.callsign,
                                    altitude=excluded.altitude,
                                    lat=excluded.lat,
                                    lon=excluded.lon,
                                    type=excluded.type,
                                    military=excluded.military,
                                    last_seen=excluded.last_seen
                            ''', (
                                icao, ac.get("callsign", ""), ac.get("altitude", ""), ac.get("lat", ""), ac.get("lon", ""),
                                ac.get("type", "Unknown"), ac.get("military", "Unknown"), ac["last_seen"]
                            ))

                            cursor.execute('''
                                INSERT INTO aircraft_history (icao, callsign, altitude, lat, lon, type, military, last_seen)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                icao, ac.get("callsign", ""), ac.get("altitude", ""), ac.get("lat", ""), ac.get("lon", ""),
                                ac.get("type", "Unknown"), ac.get("military", "Unknown"), ac["last_seen"]
                            ))
                            conn.commit()


    except Exception as e:
        print(f"[!] SBS1 error: {e}")


# === Flask Routes ===
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

## Server Status API
@app.route('/api/status')
def api_status():
    return jsonify({
        "internet_connected": True,
        "reaper_node_connected": reaper_node_connected,
        "aircraft_tracker_connected": aircraft_srd_connected,
        "reaper_node_name": connected_reaper_node_name,
        "reaper_node_port": connected_reaper_node_port,
        "backend_version": "1.4.1",
        "frontend_version": "1.7.76",
        "system_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })

## Get Aircraft API
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

## Aircraft History API
@app.route('/api/aircraft/history/<icao>')
def get_aircraft_history(icao):
    print(f"[API] Fetching history for {icao}")
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM aircraft_history WHERE icao = ? ORDER BY timestamp DESC
        ''', (icao,))
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        history = [dict(zip(columns, row)) for row in rows]
    return jsonify(history)

## Send Reaper Node Command API
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
    print("\n=========================================")
    print(" Reaper Net - Serial Web Bridge v1.0")
    print("=========================================\n")

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
    threading.Thread(target=enrich_aircraft_data, daemon=True).start()
    #threading.Thread(target=clean_aircraft_db, daemon=True).start()

    webbrowser.open("http://localhost:1776")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
