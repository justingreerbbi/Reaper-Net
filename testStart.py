import os
import time
import socket
import serial
import threading
import webbrowser
import sqlite3
import serial.tools.list_ports
import random
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

funny_messages = [
    "Why did the node cross the mesh? To ping the other side!",
    "LoRa-nge jokes incoming!",
    "I'm not a bot, I just sound like one.",
    "This message was brought to you by static.",
    "Error 404: Seriousness not found.",
    "I’m transmitting giggles.",
    "Meshin’ around again, are we?",
    "HELTEC? More like HELL-TICKLED!",
    "Direct from the cloud of nonsense.",
    "Reboot the planet!"
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
                    if line.startswith("AT+MSG") or line.startswith("AT+DMSG"):
                        ser.write(b'AT+MSG=I GOT YOU LIMIA CHARLEY\r\n')
        except Exception as e:
            print("Serial read error:", e)
            break
        time.sleep(0.05)

# === Message Senders ===
def send_random_messages(ser):
    while True:
        time.sleep(120)  # Every 2 minutes
        msg = random.choice(funny_messages)
        cmd = f"AT+MSG={msg}\r\n".encode()
        print("[Autobot] Sending funny message")
        ser.write(cmd)

def send_direct_messages(ser):
    while True:
        time.sleep(240)  # Every 4 minutes
        print("[Autobot] Sending direct message")
        ser.write(b"AT+DMSG=This is a direct message\r\n")

# === Main Entry ===
if __name__ == '__main__':
    print("\n=========================================")
    print(" Reaper Net - Serial Web Bridge v1.0")
    print("=========================================\n")

    devices = auto_find_reaper_mesh_node()
    if devices:
        port, name = next(iter(devices.items()))
        reaper_node_serial = serial.Serial(port, 115200, timeout=2)
        print(f"Connected to Reaper Node at {port} ({name})")
        threading.Thread(target=serial_reader_thread, args=(reaper_node_serial,), daemon=True).start()
        threading.Thread(target=send_random_messages, args=(reaper_node_serial,), daemon=True).start()
        threading.Thread(target=send_direct_messages, args=(reaper_node_serial,), daemon=True).start()
    else:
        print("No Reaper Mesh Node detected.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
