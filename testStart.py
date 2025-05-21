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
    "Reboot the planet!",
    "Packet loss? More like snack loss!",
    "LoRa: Because WiFi was too mainstream.",
    "Mesh networks: Where everyone’s a node-body.",
    "Serially speaking, I’m hilarious.",
    "I put the 'fun' in 'function call'.",
    "My baud rate is faster than my jokes.",
    "If you can read this, you’re too close to the antenna.",
    "I mesh well with others.",
    "Keep calm and transmit on.",
    "I’m just here for the bandwidth.",
    "Why did the packet get dropped? It couldn’t handle the pressure.",
    "I tried to debug, but it was above my pay grade.",
    "This node runs on coffee and code.",
    "LoRa: Long Range, Longer Puns.",
    "I’m not wireless, I’m just untethered.",
    "Mesh happens.",
    "I’m fluent in AT commands and sarcasm.",
    "My favorite protocol is TCP-LOL.",
    "I’m not lost, I’m just out of range.",
    "If you’re happy and you know it, send a ping."
]

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
                    if line.startswith("AT+DMSG"):
                        ser.write(b'AT+MSG=I GOT YOU LIMIA CHARLEY\r\n')
        except Exception as e:
            print("Serial read error:", e)
            break
        time.sleep(0.05)

# === Message Senders ===
def send_random_messages(ser):
    while True:
        time.sleep(115)  # Every 2 minutes
        msg = random.choice(funny_messages)
        cmd = f"AT+MSG={msg}\r\n".encode()
        print("[Autobot] Sending funny message")
        ser.write(cmd)

def send_direct_messages(ser):
    while True:
        time.sleep(240)  # Every 4 minutes
        print("[Autobot] Sending direct message")
        msg = random.choice(funny_messages)
        cmd = f"AT+DMSG=7065|{msg}\r\n".encode()
        ser.write(cmd)

def send_beacon_messages(ser):
    while True:
        time.sleep(38)  # Every 1 minute
        print("[Autobot] Sending Beacon Message")
        ser.write(b"AT+BEACON\r\n")

# === Main Entry ===
if __name__ == '__main__':
    print("\n=========================================")
    print(" Reaper Mesh - Testing Bot v1.0")
    print("=========================================\n")

    devices = auto_find_reaper_mesh_node()
    if devices:
        port, name = next(iter(devices.items()))
        reaper_node_serial = serial.Serial(port, 115200, timeout=2)
        print(f"Connected to Reaper Node at {port} ({name})")
        threading.Thread(target=serial_reader_thread, args=(reaper_node_serial,), daemon=True).start()
        threading.Thread(target=send_random_messages, args=(reaper_node_serial,), daemon=True).start()
        threading.Thread(target=send_direct_messages, args=(reaper_node_serial,), daemon=True).start()
        threading.Thread(target=send_beacon_messages, args=(reaper_node_serial,), daemon=True).start()

        # Send AT+BEACON on startup
        reaper_node_serial.write(b'AT+BEACON\r\n')
    else:
        print("No Reaper Mesh Node detected.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")
