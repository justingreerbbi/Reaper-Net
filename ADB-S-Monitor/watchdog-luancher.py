import subprocess
import time
import sys

SCRIPT = "./adsb_decoder.py"
RESTART_DELAY = 2  # seconds

def run_script():
    while True:
        print(f"\n[WATCHDOG] Launching {SCRIPT}...")
        try:
            proc = subprocess.Popen([sys.executable, SCRIPT])
            proc.wait()
            code = proc.returncode
            if code == 0:
                print("[WATCHDOG] Script exited cleanly. Restarting...")
            else:
                print(f"[WATCHDOG] Script crashed with code {code}. Restarting...")
        except Exception as e:
            print(f"[WATCHDOG] Launch error: {e}")

        time.sleep(RESTART_DELAY)

if __name__ == "__main__":
    run_script()
