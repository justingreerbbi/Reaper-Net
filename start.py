import threading
import time
import serial
import serial.tools.list_ports
import webview
from flask import Flask, jsonify, send_from_directory, request
import socket
import sqlite3
import os
import webbrowser
import sys

# === Flask app setup ===
app = Flask(__name__, static_folder='.', static_url_path='')

latest_gps_response = "NOFIX"

device_connected = False
connected_device = None

#=== REAPER NODE CONNECTIONS ===
connected_reaper_node_port = None
connected_reaper_node_name = None
reaper_node_serial = None
reaper_node_connected = False
REAPER_NODE_DETECTION_TIMEOUT = 4

print("")
print("=========================================")
print("Reaper Net - v1.7.76a")
print("=========================================")
print("")

# === Device detection ===
def auto_find_reaper_mesh_node():
    print("Scanning for Reaper Mesh Node...")
    devices = {}
    ports = list(serial.tools.list_ports.comports())
    for port in ports:
        # Skip common system ports (e.g., Bluetooth, cu.Bluetooth-Incoming-Port, etc.)
        common_names = ['Bluetooth-Incoming-Port', 'cu.Bluetooth-Incoming-Port', 'tty.Bluetooth-Incoming-Port', 'cu.debug-console', 'cu.wlan-debug']
        if port.device in devices or port.name in common_names or port.device in common_names:
            continue
        try:
            with serial.Serial(port.device, 115200, timeout=REAPER_NODE_DETECTION_TIMEOUT) as ser:
                ser.flushInput()
                time.sleep(0.5)  # Give it a moment after connect
                start = time.time()
                buffer = ""
                ser.write(b'AT+DEVICE\r\n')
                while time.time() - start < REAPER_NODE_DETECTION_TIMEOUT:
                    if ser.in_waiting:
                        line = ser.readline().decode(errors='ignore').strip()
                        #print(f"[{port.device}] {line}")
                        buffer += line + "\n"
                        if line.startswith("HELTEC|READY|"):
                            label = line.split("|")[2]
                            devices[port.device] = label
                            break
        except (serial.SerialException, OSError) as e:
            print(f"Failed to open {port.device}: {e}")

    return devices

# === Database setup ===
def init_db():

    print("")
    print("Initializing database...")
    print("")

    db_path = os.path.join(os.path.dirname(__file__), 'reaper_net.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create preferences table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT
        )
    ''')

    # Create map markers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS map_markers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            label TEXT,
            marker_type TEXT,
            color TEXT,
            icon TEXT,
            size INTEGER,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create polygons table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS polygons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            coordinates TEXT NOT NULL -- JSON string to store polygon coordinates
        )
    ''')

    conn.commit()
    conn.close()

# Base route for serving the the map.
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Route for getting the map markers
@app.route('/api/markers')
def get_markers():
    conn = sqlite3.connect('reaper_net.db')
    cursor = conn.cursor()

    # Fetch all markers from the database
    cursor.execute("SELECT * FROM map_markers")
    markers = cursor.fetchall()

    # Convert to a list of dictionaries
    markers_list = []
    for marker in markers:
        markers_list.append({
            "id": marker[0],
            "latitude": marker[1],
            "longitude": marker[2],
            "label": marker[3],
            "marker_type": marker[4],
            "color": marker[5],
            "icon": marker[6],
            "size": marker[7],
            "description": marker[8],
            "created_at": marker[9],
            "updated_at": marker[10]
        })

    conn.close()
    return jsonify(markers_list)

# Route for saving a new marker
@app.route('/api/save_marker', methods=['POST'])
def save_marker():
    data = request.get_json()
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    label = 'Label'
    marker_type = 'Marker Type'
    color = 'Blue'
    icon = 'Custom Icon'
    size = '0'
    description = 'Random description'

    conn = sqlite3.connect('reaper_net.db')
    cursor = conn.cursor()

    # Insert the new marker into the database
    cursor.execute('''
        INSERT INTO map_markers (latitude, longitude, label, marker_type, color, icon, size, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (latitude, longitude, label, marker_type, color, icon, size, description))

    conn.commit()
    conn.close()

    return jsonify({"message": "Marker saved successfully!"})

# Route for api status
@app.route('/api/status')
def api_status():
    def check_internet():
        try:
            # Attempt to connect to a reliable public server (Google's DNS)
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False

    internet_status = check_internet()

    return jsonify({
        "internet_connected": internet_status,
        "device_connected": device_connected,
        "device": connected_device,
        "reaper_node_connected": reaper_node_connected,
        "reaper_node_name": connected_reaper_node_name,
        "reaper_node_port": connected_reaper_node_port,
        })

@app.route('/api/gps')
def get_gps():
    return jsonify({"gps": latest_gps_response})

# === Flask server runner ===
def run_flask():
    app.run(port=1776)

# === Serial communication thread ===
def serial_thread(port, ready_flag):
    global latest_gps_response
    try:
        ser = serial.Serial(port, 115200, timeout=2)
        print(f"\nConnected to {port} at 115200 baud.")

        # Wait for the device to send "NR=READY"
        print("Waiting for device to be ready...")
        while True:
            response = ser.readline().decode().strip().rstrip('\r\n')
            if response:
                print("[Device]", response)
                if response == "NR=READY":
                    print("Device is ready!")
                    ready_flag.set()
                    break

        # Start GPS polling thread
        def gps_polling():
            nonlocal ser
            while True:
                print("NR+GPS")
                ser.write(b'NR+GPS\n')
                gps_resp = ser.readline().decode().strip()
                print("[Device]", gps_resp)
                if "NR+GPS=LAT" in gps_resp:
                    global latest_gps_response
                    latest_gps_response = gps_resp
                time.sleep(5)

        threading.Thread(target=gps_polling, daemon=True).start()

        # Command line input loop
        print("\nYou may now enter commands to send to the device:")
        while True:
            cmd = input(">>> ").strip()
            if cmd:
                ser.write((cmd + '\r\n').encode())
                response = ser.readline().decode().strip().rstrip('\r\n')
                if response:
                    print("[Device]", response)

    except serial.SerialException as e:
        print(f"Serial connection error: {e}")

# === Entry point ===
if __name__ == '__main__':

    ## STEP 1: Check for a Reaper Node
    reaper_node_search = auto_find_reaper_mesh_node()
    if reaper_node_search:
        for port, name in reaper_node_search.items():
            if not connected_reaper_node_port:
                reaper_node_connected = True
                connected_reaper_node_port = port
                connected_reaper_node_name = name
                reaper_node_serial = serial.Serial(port, 115200, timeout=2)
                print("Successfully connected to Reaper Node at port:", port + " (" + name + ")")                
    else:
        print("No Reaper Nodes Found.")

    #sys.exit(0)

    ## STEP 2: Check for Main Nina Device

    ## STEP 3: Initialize database ===
    init_db()


    # Start Flask server
    threading.Thread(target=run_flask, daemon=True).start()
    print("Launching GUI without serial communication...")

    # Launch webview window
    #window = webview.create_window("Nina The Reaper", "http://localhost:1776", width=1000, height=700)
    #webview.start(debug=True)

    # Launch webview window with custom HTML
    # Open the default web browser to the Flask server URL
    webbrowser.open("http://localhost:1776/api/status")

    # Keep the server running until manually closed
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServer shutting down...")
