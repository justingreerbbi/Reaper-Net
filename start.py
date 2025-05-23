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

# === Flask + SocketIO setup ===
app = Flask(__name__, static_folder='.', static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# === Reaper Node Serial State ===
reaper_node_serial = None
reaper_node_connected = False
connected_reaper_node_port = None
connected_reaper_node_name = None

REAPER_NODE_DETECTION_TIMEOUT = 4

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

# === Start Server ===
def start_server():
    socketio.run(app, port=1776)

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

    threading.Thread(target=start_server, daemon=True).start()
    webbrowser.open("http://localhost:1776")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
