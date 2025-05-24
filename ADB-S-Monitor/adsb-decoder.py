# Reaper ADS-B Decoder
import time
import numpy as np
import ctypes
import requests
from math import degrees, atan
from collections import defaultdict
from hackrf import HackRF

SAMPLE_RATE = 2000000
CENTER_FREQ = 1090000000
THRESHOLD = 18000

aircraft_state = defaultdict(dict)
CHARSET = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ#####_###############0123456789######"

NL_TABLE = [59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44,
            43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28,
            27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12,
            11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

def magnitude(i, q):
    return (i - 127) ** 2 + (q - 127) ** 2

def bits_to_bytes(bits):
    out = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for j in range(8):
            byte = (byte << 1) | bits[i + j]
        out.append(byte)
    return bytes(out)

def crc_check(msg_bytes):
    poly = 0xFFFA0480
    msg = int.from_bytes(msg_bytes[:11], 'big')
    for i in range(88):
        shift = 87 - i - 24
        if msg & (1 << (87 - i)) and shift >= 0:
            msg ^= poly << shift
    crc = msg & 0xFFFFFF
    expected = int.from_bytes(msg_bytes[11:14], 'big')
    return crc == expected

def decode_callsign(msg):
    cs = ""
    for i in range(6):
        byte = msg[5 + i]
        left = byte >> 4
        right = byte & 0x0F
        cs += CHARSET[left] + CHARSET[right]
    return cs.replace("#", "").strip()

def decode_altitude(msg):
    raw = ((msg[5] & 0x07) << 8) | msg[6]
    q = (msg[5] >> 4) & 1
    if q:
        n = raw & 0x3FF
        return n * 25 - 1000
    return None

def decode_velocity(msg):
    subtype = (msg[4] >> 1) & 0x07
    if subtype in [1, 2]:
        ew_dir = (msg[5] >> 7) & 1
        ew_vel = ((msg[5] & 0x7F) << 3) | (msg[6] >> 5)
        ns_dir = (msg[6] >> 4) & 1
        ns_vel = ((msg[6] & 0x0F) << 6) | (msg[7] >> 2)
        speed = round((ew_vel ** 2 + ns_vel ** 2) ** 0.5)
        heading = round(degrees(atan(ew_vel / ns_vel))) if ns_vel != 0 else 0
        return speed, heading
    return None

def decode_cpr(msg, is_odd):
    lat_cpr = ((msg[6] & 0x03) << 15) | (msg[7] << 7) | (msg[8] >> 1)
    lon_cpr = ((msg[8] & 0x01) << 16) | (msg[9] << 8) | msg[10]
    return lat_cpr / 131072.0, lon_cpr / 131072.0

def cprNL(lat):
    if abs(lat) < 10e-6:
        return 59
    if abs(lat) >= 87:
        return 1
    return NL_TABLE[int(abs(lat))]

def decode_position(even, odd):
    lat_even, lon_even = decode_cpr(even['msg'], 0)
    lat_odd, lon_odd = decode_cpr(odd['msg'], 1)
    t_even, t_odd = even['time'], odd['time']

    j = int(59 * lat_even - 60 * lat_odd + 0.5)
    rlat_even = 360.0 / 60 * ((j % 60) + lat_even)
    rlat_odd = 360.0 / 59 * ((j % 59) + lat_odd)

    if t_even > t_odd:
        lat = rlat_even
        ni = cprNL(lat)
        m = int(lon_even * (ni - 1) - lon_odd * ni + 0.5)
        lon = (360.0 / ni) * ((m % ni) + lon_even)
    else:
        lat = rlat_odd
        ni = cprNL(lat)
        m = int(lon_even * (ni - 1) - lon_odd * ni + 0.5)
        lon = (360.0 / ni) * ((m % ni) + lon_odd)

    if lon > 180: lon -= 360
    if lat > 270: lat -= 360
    return round(lat, 5), round(lon, 5)

def get_aircraft_info(icao_hex):
    try:
        url = f"https://hexdb.io/api/v1/hex/{icao_hex}"
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            data = response.json()
            return {
                "registration": data.get("reg", "N/A"),
                "type": data.get("type", "N/A"),
                "owner": data.get("owner", "N/A"),
                "built": data.get("built", "N/A")
            }
    except Exception as e:
        print(f"[LOOKUP ERROR] ICAO={icao_hex}: {e}")
    return None

def decode_adsb_message(msg, timestamp):
    if len(msg) < 14:
        return None

    df = (msg[0] >> 3) & 0x1F
    if df != 17:
        return None

    icao = msg[1:4].hex().upper()
    tc = (msg[4] >> 3) & 0x1F
    state = aircraft_state[icao]
    
    # Bail is type is not 17. We don;t care about it.
    # @todo: Maybe we still track the ICAO just to know it's there?
    if tc != 17:
        return None
    
    updated = False

    if "lookup" not in state:
        lookup = get_aircraft_info(icao)
        if lookup:
            state.update(lookup)
        state["lookup"] = True

    if 1 <= tc <= 4:
        cs = decode_callsign(msg)
        if state.get('callsign') != cs:
            state['callsign'] = cs
            updated = True

    elif 9 <= tc <= 18:
        alt = decode_altitude(msg)
        if state.get('altitude') != alt:
            state['altitude'] = alt
            updated = True
        if ((msg[6] >> 3) & 1) == 0:
            state['even'] = {'msg': msg, 'time': timestamp}
        else:
            state['odd'] = {'msg': msg, 'time': timestamp}
        if 'even' in state and 'odd' in state:
            try:
                lat, lon = decode_position(state['even'], state['odd'])
                if state.get('position') != (lat, lon):
                    state['position'] = (lat, lon)
                    updated = True
            except Exception as e:
                print(f"[CPR ERROR] {e}")

    elif tc == 19:
        vh = decode_velocity(msg)
        if vh and (state.get('speed'), state.get('heading')) != vh:
            state['speed'], state['heading'] = vh
            updated = True

    state['last_type_code'] = tc
    state['last_seen'] = timestamp

    display = {
        "ICAO": icao,
        "Type": tc,
        "Callsign": state.get('callsign', 'N/A'),
        "Altitude": state.get('altitude', 'N/A'),
        "Speed": state.get('speed', 'N/A'),
        "Heading": state.get('heading', 'N/A'),
        "Position": state.get('position', 'N/A'),
        "Registration": state.get('registration', 'N/A'),
        "Aircraft Type": state.get('type', 'N/A'),
        "Owner": state.get('owner', 'N/A'),
        "Built": state.get('built', 'N/A'),
        "Last Seen": time.strftime('%H:%M:%S', time.localtime(state['last_seen']))
    }

    print(f"[AIRCRAFT] {display}")
    return state

def burst_detector(transfer, ctx=None):
    try:
        # Ensure pointer and length are safe
        if not transfer or not transfer.contents:
            return 0

        buf_ptr = transfer.contents.buffer
        buf_len = transfer.contents.valid_length

        if not buf_ptr or buf_len <= 0:
            return 0

        # Copy safely
        raw = ctypes.string_at(buf_ptr, buf_len)

        # Validate size before reshape
        if len(raw) % 2 != 0:
            return 0  # must be even for IQ pairs

        samples = np.frombuffer(raw, dtype=np.uint8)

        if len(samples) % 2 != 0:
            return 0  # guard against reshape crash

        iq = samples.reshape(-1, 2)

        mags = np.array([magnitude(i, q) for i, q in iq])
        timestamp = time.time()

        for i in range(0, len(mags) - 240):
            p = mags[i:i+16]
            if (p[0] > THRESHOLD and p[2] > THRESHOLD and p[4] > THRESHOLD and p[11] > THRESHOLD and
                np.mean(p[1:2]) < THRESHOLD and np.mean(p[3:11]) < THRESHOLD and np.mean(p[12:16]) < THRESHOLD):
                bits = [(1 if mags[i + 16 + b * 2] > THRESHOLD else 0) for b in range(112)]
                msg_bytes = bits_to_bytes(bits)
                decode_adsb_message(msg_bytes, timestamp)
                break
    except Exception as e:
        print(f"[ERROR] Burst detector failed: {e}")
    return 0


def main():
    hackrf = HackRF()
    try:
        hackrf.sample_rate = SAMPLE_RATE
        hackrf.center_freq = CENTER_FREQ
        hackrf.lna_gain = 40
        hackrf.vga_gain = 62
        print("[*] Starting Reaper ADS-B decoder...")
        hackrf.start_rx(burst_detector)
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n[!] Interrupted.")
    finally:
        hackrf.stop_rx()
        hackrf.close()

if __name__ == "__main__":
    main()
