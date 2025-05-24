import subprocess
import argparse
import datetime
import os
import struct
import time

DEFAULT_GAIN = 40
DEFAULT_THRESHOLD = 20000  # lowered for better burst detection
LOG_FOLDER = "logs"
BLOCK_SIZE = 512 * 1024  # 512KB

def parse_args():
    parser = argparse.ArgumentParser(description="Manual ADS-B decoder using HackRF")
    parser.add_argument("--gain", type=int, default=DEFAULT_GAIN, help="RF gain (default: 40)")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD, help="Signal threshold (default: 20000)")
    parser.add_argument("--debug", action="store_true", help="Enable burst debug printing")
    return parser.parse_args()

def create_log_file():
    os.makedirs(LOG_FOLDER, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(LOG_FOLDER, f"adsb_log_{timestamp}.txt")
    return open(log_path, "w")

def magnitude(i, q):
    mag = (i - 127)**2 + (q - 127)**2
    return mag

def detect_adsb_bursts(iq_bytes, threshold, debug=False):
    results = []
    for i in range(0, len(iq_bytes) - 240, 2):
        window = iq_bytes[i:i+240]
        mags = [magnitude(window[j], window[j+1]) for j in range(0, len(window), 2)]
        if mags[0] > threshold:
            data_bits = []
            try:
                for bit in range(112):
                    sample = mags[16 + bit * 2]
                    data_bits.append(1 if sample > threshold else 0)
                if data_bits.count(1) > 40:  # rough sanity filter
                    if debug:
                        print(f"[DEBUG] Burst at offset {i}, peak power: {max(mags[:40])}, bit 1s: {data_bits.count(1)}")
                    results.append((i, data_bits))
            except IndexError:
                continue
    return results

def bits_to_bytes(bits):
    out = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for j in range(8):
            byte = (byte << 1) | bits[i + j]
        out.append(byte)
    return bytes(out)

def decode_adsb_message(msg_bytes):
    if len(msg_bytes) < 14:
        return "Invalid frame length"

    icao = msg_bytes[1:4].hex().upper()
    type_code = (msg_bytes[4] >> 3) & 0x1F
    msg_type = f"Type {type_code}"

    return f"ICAO={icao}, {msg_type}, RAW={msg_bytes.hex().upper()}"

def run_decoder(args, log_file):
    cmd = [
        "hackrf_transfer",
        "-r", "-",                   # stream to stdout
        "-f", "1090000000",          # 1090 MHz
        "-g", str(args.gain),
        "-s", "2000000"              # 2 Msps
    ]

    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as proc:
        while True:
            raw = proc.stdout.read(BLOCK_SIZE)
            if not raw:
                print("[!] HackRF stream ended unexpectedly.")
                break

            bursts = detect_adsb_bursts(raw, args.threshold, debug=args.debug)
            for offset, bits in bursts:
                msg_bytes = bits_to_bytes(bits)
                try:
                    msg = decode_adsb_message(msg_bytes)
                except Exception:
                    msg = f"[INVALID] Could not decode: {msg_bytes.hex().upper()}"
                print("[ADS-B]", msg)
                log_file.write(msg + "\n")
                log_file.flush()

def main():
    args = parse_args()
    log_file = create_log_file()

    print(f"[*] Starting manual ADS-B decoder at 1090 MHz with gain={args.gain}, threshold={args.threshold}")
    if args.debug:
        print("[*] Debug mode enabled: printing burst power info\n")

    try:
        while True:
            print("[*] Starting new scan session...")
            run_decoder(args, log_file)
            print("[!] HackRF stopped. Restarting scan in 3 seconds...\n")
            time.sleep(3)

    except KeyboardInterrupt:
        print("\n[!] User interrupted. Exiting...")
    finally:
        log_file.close()

if __name__ == "__main__":
    main()
