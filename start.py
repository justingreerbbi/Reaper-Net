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

# === Flask app setup ===
app = Flask(__name__, static_folder='.', static_url_path='')

latest_gps_response = "NOFIX"
device_connected = False
connected_device = None

print("")
print("=========================================")
print("Reaper Net - v1.7.76a")
print("=========================================")
print("")

# === Database setup ===
def init_db():
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

# Initialize the database
print("")
print("Initializing database...")
print("")
init_db()

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
        "is_connected_to_internet": internet_status,
        "device_connected": device_connected,
        "device": connected_device,
        })
    return jsonify({"message": "Hello from Flask!"})

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
    # List available COM ports
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("No serial ports found.")
        exit(1)

    print("")
    print("OPTIONS:")
    print("")
    print("[s] Skip serial communication")
    print("[x] Exit")
    print("")
    print("----------------------")
    print("")
    print("Available COM Ports:")
    print("")

    for i, port in enumerate(ports):
        print(f"[{i}] {port.device}")
    print("")

    selection = input("SELECT DEVICE OR SKIP (s): ").strip()
    if not selection == "s":
        try:
            port = ports[int(selection)].device
        except (IndexError, ValueError):
            print("Invalid selection.")
            exit(1)

    # Start Flask server
    threading.Thread(target=run_flask, daemon=True).start()

    # If the user selected a port, start the serial communication thread
    if not selection == "s":
        print('Starting serial communication...')
        print(f"Selected port: {port}")
        device_ready = threading.Event()
        threading.Thread(target=serial_thread, args=(port, device_ready), daemon=True).start()
        print("Waiting to launch GUI...")
        device_ready.wait()
    else:
        print("LAunching GUI without serial communication...")

    # Launch webview window
    #window = webview.create_window("Nina The Reaper", "http://localhost:1776", width=1000, height=700)
    #webview.start(debug=True)

    # Launch webview window with custom HTML
    # Open the default web browser to the Flask server URL
    webbrowser.open("http://localhost:1776")

    # Keep the server running until manually closed
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServer shutting down...")
