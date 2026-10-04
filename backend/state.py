from datetime import datetime

attendance = {}

# index → {status, time}
attendance_state = {}

def update_attendance(boxes, arduino_states):
    """
    boxes: data z Excelu (jména, absent/holiday/empty)
    arduino_states: pole bool z Arduina
    """

    for i, box in enumerate(boxes):

        # ignorujeme prázdné / svátky
        if box.get("status") != "absent":
            continue

        # pokud Arduino hlásí přítomnost
        if arduino_states[i]:

            # pokud osoba ještě NENÍ v attendance_state
            if i not in attendance_state:
                attendance_state[i] = {
                    "status": "present",
                    "time": datetime.now().strftime("%d.%m.%Y %H:%M")
                }

            # promítneme uložený stav do boxu
            box["status"] = "present"
            box["time"] = attendance_state[i]["time"]