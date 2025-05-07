import serial
import threading
import socketserver
import json

import serial.tools.list_ports
import http.server

def list_com_ports():
    ports = serial.tools.list_ports.comports()
    return [port.device for port in ports]

def select_com_port():
    ports = list_com_ports()
    if not ports:
        print("No COM ports available.")
        return None
    print("Available COM ports:")
    for i, port in enumerate(ports):
        print(f"{i + 1}: {port}")
    choice = int(input("Select a COM port by number: ")) - 1
    return ports[choice] if 0 <= choice < len(ports) else None

def select_baud_rate():
    baud_rate = input("Enter baud rate (e.g., 9600): ")
    return int(baud_rate)

def serial_reader(ser):
    while True:
        try:
            if ser.in_waiting > 0:
                print(ser.readline().decode('utf-8').strip())
        except Exception as e:
            print(f"Error reading from serial port: {e}")
            break

def serial_writer(ser):
    while True:
        try:
            command = input("Enter command to send to the device: ")
            ser.write(command.encode('utf-8') + b'\n')
        except Exception as e:
            print(f"Error writing to serial port: {e}")
            break

class SimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/test':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {'message': 'This is a test endpoint'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def start_http_server():
    PORT = 1776
    handler = SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving HTTP on port {PORT}")
        httpd.serve_forever()

def main():
    com_port = select_com_port()
    if not com_port:
        return

    baud_rate = select_baud_rate()

    try:
        ser = serial.Serial(com_port, baud_rate, timeout=1)
        print(f"Connected to {com_port} at {baud_rate} baud.")
    except Exception as e:
        print(f"Failed to connect to {com_port}: {e}")
        return

    threading.Thread(target=serial_reader, args=(ser,), daemon=True).start()
    threading.Thread(target=start_http_server, daemon=True).start()

    serial_writer(ser)

if __name__ == "__main__":
    main()