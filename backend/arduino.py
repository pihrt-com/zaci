import serial
import time
import threading
import logging
from serial.tools import list_ports

BAUD = 115200
TIMEOUT = 2
ARDUINO_PORT = "/dev/ttyACM0"

_ser = None
_lock = threading.Lock()


def find_arduino_port():
    for port in list_ports.comports():
        desc = (port.description or "").lower()
        hwid = (port.hwid or "").lower()

        if any(x in desc for x in ["arduino", "ch340", "usb serial", "cp210", "ftdi"]):
            logging.info("Arduino detected on %s (%s)", port.device, port.description)
            return port.device

    logging.warning("No Arduino detected")
    return None


def open_serial():
    global _ser

    if _ser and _ser.is_open:
        return _ser

    port = ARDUINO_PORT or find_arduino_port()
    if port is None:
        raise RuntimeError("Arduino not found")

    logging.info("Opening serial port %s", port)

    _ser = serial.Serial(
        port=port,
        baudrate=BAUD,
        timeout=TIMEOUT,
        dsrdtr=True,   # ⬅️ DŮLEŽITÉ – zabrání resetu
        rtscts=False
    )

    # NESHODIT DTR / RTS !
    time.sleep(2)  # Arduino doběhne setup()

    return _ser


def read_attendance():
    global _ser

    with _lock:
        ser = open_serial()

        ser.reset_input_buffer()
        ser.write(b'U')

        line = ser.readline().decode(errors="ignore").strip()

        if len(line) != 10 or not all(c in "01" for c in line):
            logging.warning("Invalid Arduino response: %r", line)
            return None

        return [c == "1" for c in line]


if __name__ == "__main__":
    print(read_attendance())