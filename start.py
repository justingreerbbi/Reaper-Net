import threading
import time
import serial
import serial.tools.list_ports
from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit
import socket
import sqlite3
import os
import webbrowser

# === Flask + SocketIO setup ===
app = Flask(__name__, static_folder='.', static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# === Reaper Node Serial State ===
reaper_node_serial = None
reaper_node_connected = False
connected_reaper_node_port = None
connected_reaper_node_name = None
REAPER_NODE_DETECTION_TIMEOUT = 4

# === Reaper Node Detection ===
def auto_find_reaper_mesh_node():
    print("Scanning for Reaper Mesh Node...")
    devices = {}
    ports = list(serial.tools.list_ports.comports())
    for port in ports:

        # Slip over common devices that just eat of up scanning time.
        if any(skip in port.device for skip in ['Bluetooth', 'debug']):
            continue
        try:
            # Attempt to open the port and send a command to detect the Reaper Node
            with serial.Serial(port.device, 115200, timeout=REAPER_NODE_DETECTION_TIMEOUT) as ser:
                ser.flushInput()
                time.sleep(0.5)

                # Send AT+DEVICE command. If the device is a Reaper Node, it should respond with HELTEC|READY|<DEVICE_NAME>.
                ser.write(b'AT+DEVICE\r\n')
                start = time.time()
                buffer = ""

                # Wait for a response from the device and check if the response (if any) starts with HELTEC|READY|.
                while time.time() - start < REAPER_NODE_DETECTION_TIMEOUT:
                    if ser.in_waiting:
                        line = ser.readline().decode(errors='ignore').strip()
                        buffer += line + "\n"
                        if line.startswith("HELTEC|READY|"):
                            label = line.split("|")[2]
                            devices[port.device] = label
                            break
        except (serial.SerialException, OSError) as e:
            print(f"Failed to open {port.device}: {e}")
    return devices

# === Serial RX Thread ===
def serial_reader_thread(ser):
    while True:
        try:
            if ser.in_waiting:
                line = ser.readline().decode(errors='ignore').strip()
                if line:
                    print("[Reaper Node]", line)
                    socketio.emit('serial_data', {'line': line})
        except Exception as e:
            print("Serial read error:", e)
            break
        time.sleep(0.05)

# === WebSocket Command Handler For a Reaper Node ===
@socketio.on('send_reaper_node_command')
def handle_send_command(data):
    command = data.get('command', '')
    if reaper_node_serial and command:
        print(f"{command}\r\n".encode())
        reaper_node_serial.write(f"{command}\n".encode())

# === API: Root Page ===
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# === API: Connection Status ===
@app.route('/api/status')
def api_status():
    def check_internet():
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False
    return jsonify({
        "internet_connected": check_internet(),
        "reaper_node_connected": reaper_node_connected,
        "reaper_node_name": connected_reaper_node_name,
        "reaper_node_port": connected_reaper_node_port,
    })

# === Flask Background Server ===
def start_server():
    socketio.run(app, port=1776)

# === Entry Point ===
if __name__ == '__main__':
    print("=========================================")
    print(" Reaper Net - Serial Web Bridge v1.0")
    print("=========================================\n")

    # Step 1: Detect and Connect to Reaper Node
    devices = auto_find_reaper_mesh_node()
    if devices:
        for port, name in devices.items():
            connected_reaper_node_port = port
            connected_reaper_node_name = name
            reaper_node_serial = serial.Serial(port, 115200, timeout=2)
            reaper_node_connected = True
            print(f"Connected to Reaper Node at {port} ({name})")
            threading.Thread(target=serial_reader_thread, args=(reaper_node_serial,), daemon=True).start()
            break
    else:
        print("No Reaper Mesh Node detected.")

    # Step 2: Launch Server + Browser
    threading.Thread(target=start_server, daemon=True).start()
    webbrowser.open("http://localhost:1776")

    # Keep alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
