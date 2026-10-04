from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from excel_loader import load_boxes_from_excel
from arduino import read_attendance
from state import update_attendance, attendance_state

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from datetime import datetime, timedelta, date

import threading
import time

import logging
from logging.handlers import RotatingFileHandler

import requests

REMOTE_UPDATE_URL = "https://zaci.pihrt.com/update.php"
REMOTE_UPDATE_INTERVAL = 5  # sekundy refresh
REMOTE_SECRET = "your pass"

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

log_file = LOG_DIR / "dochazka.log"

handler = RotatingFileHandler(
    log_file,
    maxBytes=1_000_000,   # 1 MB
    backupCount=5         # 5 souborů
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[handler, logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# DEBUG – klidně tam nech
print("STATIC_DIR =", STATIC_DIR)
print("STATIC EXISTS =", STATIC_DIR.exists())
print("STATIC FILES =", list(STATIC_DIR.glob("*")))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

arduino_last_seen = None
attendance_cache = None
attendance_lock = threading.Lock()
arduino_thread_running = True
remote_thread_running = True
last_reset_date = date.today()

def build_status_payload():
    boxes = load_boxes_from_excel()

    # denní reset
    daily_reset_if_needed(boxes)

    with attendance_lock:
        arduino = attendance_cache

    if arduino is not None:
        update_attendance(boxes, arduino)

    online, last_seen = get_arduino_status()

    return {
        "arduino": {
            "online": online,
            "last_seen": last_seen.strftime("%Y-%m-%d %H:%M:%S") if last_seen else None
        },
        "boxes": boxes
    }

def push_status_to_remote():
    global remote_thread_running

    logging.info("Remote push thread started")

    while remote_thread_running:
        try:
            payload = build_status_payload()

            r = requests.post(
                REMOTE_UPDATE_URL,
                json=payload,
                headers={
                    "X-DOCHAZKA-SECRET": REMOTE_SECRET
                },
                timeout=5
            )

            if r.status_code != 200:
                logging.warning(
                    "Remote update failed: %s %s",
                    r.status_code,
                    r.text
                )
            else:
                logging.debug("Remote update OK")

        except Exception as e:
            logging.error("Remote update error: %s", e)

        time.sleep(REMOTE_UPDATE_INTERVAL)


def daily_reset_if_needed(boxes):
    global last_reset_date

    today = date.today()
    if today != last_reset_date:
        logging.info("Daily reset triggered (%s → %s)", last_reset_date, today)

        attendance_state.clear()   # ← KRITICKÉ

        for box in boxes:
            if box.get("status") == "present":
                box["status"] = "absent"
                box.pop("time", None)

        last_reset_date = today

def poll_arduino():
    global attendance_cache, arduino_thread_running, arduino_last_seen

    logging.info("Arduino polling thread started")

    while arduino_thread_running:
        try:
            data = read_attendance()
            if data is not None:
                with attendance_lock:
                    attendance_cache = data
                    arduino_last_seen = datetime.now()
                logging.debug("Arduino cache updated")
        except Exception as e:
            logging.error("Arduino polling error: %s", e)

        time.sleep(2)

def get_arduino_status():
    if arduino_last_seen is None:
        return False, None

    # pokud jsme neslyšeli Arduino déle než 5 sekund → OFFLINE
    offline_limit = timedelta(seconds=5)

    online = (datetime.now() - arduino_last_seen) <= offline_limit
    return online, arduino_last_seen

@app.get("/")
def serve_frontend():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/status")
def status():
    logging.info("---- /status called ----")

    boxes = load_boxes_from_excel()

    # denní reset
    daily_reset_if_needed(boxes)

    with attendance_lock:
        arduino = attendance_cache

    if arduino is not None:
        update_attendance(boxes, arduino)

    online, last_seen = get_arduino_status()

    return {
        "arduino": {
            "online": online,
            "last_seen": last_seen.strftime("%Y-%m-%d %H:%M:%S") if last_seen else None
        },
        "boxes": boxes
    }


@app.on_event("shutdown")
def stop_arduino_thread():
    global arduino_thread_running, remote_thread_running
    arduino_thread_running = False
    remote_thread_running = False
    logging.info("Arduino polling thread stopped")

@app.on_event("startup")
def start_arduino_thread():
    threading.Thread(target=poll_arduino, daemon=True).start()
    threading.Thread(target=push_status_to_remote, daemon=True).start()