import os
import time
import socket
import serial
import threading
import webbrowser
import sqlite3
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

REAPER_NODE_DETECTION_TIMEOUT = 4

# AIRCRAFT DATA
aircraft_data = {}
SBS1_FIELDS = [
    "message_type", "transmission_type", "session_id", "aircraft_id",
    "hex_ident", "flight_id", "generated_date", "generated_time",
    "logged_date", "logged_time", "callsign", "altitude", "ground_speed",
    "track", "lat", "lon", "vertical_rate", "squawk",
    "alert", "emergency", "spi", "is_on_ground"
]

# === Utility: Check Internet ===
def check_internet():
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3)
        return True
    except OSError:
        return False

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

# === Serial Reader Thread ===
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

# === WebSocket Handler ===
@socketio.on('send_reaper_node_command')
def handle_send_command(data):
    print(f"[RECEIVED] {data}")
    command = data.get('command', '').strip()
    if reaper_node_serial and command:
        print(f"[SEND] {command}")
        reaper_node_serial.write(f"{command}\n".encode())

# === Aircraft Monitor ===
def parse_sbs1_line(line):
    parts = line.strip().split(',')
    if len(parts) < 22:
        return None

    parsed = dict(zip(SBS1_FIELDS, parts))
    return parsed

def sbs1_listener(host='127.0.0.1', port=30003):
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
                for line in lines:
                    parsed = parse_sbs1_line(line)
                    if parsed and parsed.get("hex_ident"):
                        icao = parsed["hex_ident"]
                        # Merge fields into current state
                        ac = aircraft_data.setdefault(icao, {})
                        ac.update({k: v for k, v in parsed.items() if v})
                        ac["last_seen"] = time.strftime("%Y-%m-%d %H:%M:%S")
    except Exception as e:
        print(f"[!] Error connecting to SBS1 feed: {e}")

# === Routes ===
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Status API
@app.route('/api/status')
def api_status():
    return jsonify({
        "internetConnected": check_internet(),
        "reaperNodeConnected": reaper_node_connected,
        "aircraftSrdConnected": aircraft_srd_connected,
        "reaperNodeName": connected_reaper_node_name,
        "reaperNodePort": connected_reaper_node_port,
        "backendVersion": "1.4.1",
        "frontendVersion": "1.7.76",
        "systemTime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
    })

# Plugins API
@app.route('/api/plugins')
def list_plugins():
	plugins_dir = os.path.join(app.root_path, 'plugins')
	plugin_files = [f for f in os.listdir(plugins_dir) if f.endswith('.js')]
	return jsonify([os.path.splitext(p)[0] for p in plugin_files])

@app.route('/api/aircraft')
def get_aircraft():
    return jsonify(aircraft_data)

# === Start Server ===
def start_server():
    socketio.run(app, port=1776)

# === Webview Setup ===
def launch_window():
    subprocess.Popen([
        "chromium-browser",
        "--app=http://localhost:1776",
        "--window-size=1024,768",
        "--noerrdialogs",
        "--disable-infobars",
        #"--kiosk"  # Optional: for fullscreen kiosk mode
    ])

# === Main Entry ===
if __name__ == '__main__':
    print("")
    print("=========================================")
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

    # Start Flask server in background
    threading.Thread(target=start_server, daemon=True).start()

     # Start SBS1 listener in background
    threading.Thread(target=sbs1_listener, daemon=True).start()

    # Wait for the server to start
    while not socketio.server:
        time.sleep(0.1)
    
    # Launch application window.
    #launch_window()

    # Development
    webbrowser.open("http://localhost:1776")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
