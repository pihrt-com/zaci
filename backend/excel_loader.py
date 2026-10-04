import pandas as pd
from datetime import date

# ===== TEST MODE =====
TEST_DAY = None  # None, 0=Po, 1=Út, 2=St, 3=Čt, 4=Pá

EXCEL_FILE = "data/rozvrh.xlsx"

DAYS = {
    0: "Po",
    1: "Út",
    2: "St",
    3: "Čt",
    4: "Pá",
}

def is_even_week():
    return date.today().isocalendar().week % 2 == 0

def load_boxes_from_excel():
    # víkend → svátek
    weekday = TEST_DAY if TEST_DAY is not None else date.today().weekday()
    if weekday > 4:
        return [{"status": "empty"} for _ in range(10)]

    sheet = "S" if is_even_week() else "L"
    day_name = DAYS[weekday]

    df = pd.read_excel(
        EXCEL_FILE,
        sheet_name=sheet,
        header=None
    )

    # najdeme řádek dne
    row = df[df[0] == day_name]
    if row.empty:
        return [{"status": "empty"} for _ in range(10)]

    row = row.iloc[0]

    boxes = []
    for col in range(1, 11):
        cell = row[col]

        if pd.isna(cell):
            boxes.append({"status": "empty"})
        elif str(cell).strip().upper() == "SVÁTEK":
            boxes.append({"status": "holiday"})
        else:
            boxes.append({
                "name": str(cell).strip(),
                "status": "absent"
            })

    return boxes
