
// const DATA_SOURCE = "/api/status";

// Web mirror (static JSON):
// const DATA_SOURCE = "/status.json";

// Auto-detect json path:
const DATA_SOURCE = location.hostname === "localhost"
  ? "status"
  : "data/status.json";

const container = document.getElementById("container");
const rfidBanner = document.getElementById("rfid-status");
const dateEl = document.getElementById("date");
const timeEl = document.getElementById("time");
const weekdayEls = document.querySelectorAll(".weekdays span");
const dataBanner = document.getElementById("data-status");
const weekParityEl = document.getElementById("week-parity");
let lastSuccessfulLoad = null;

// pevné pořadí boxů (grid layout)
const boxOrder = [5,4,3,2,1,6,7,8,9,10];
let lastDataJSON = null;
let lastStates = [];
const boxesDOM = {};
let initialized = false;
let dataStale = false;
const DATA_STALE_LIMIT = 7000; // ms (python do php posila data co 5 vterin)

async function load() {
  try {
    const dataUrl = new URL(DATA_SOURCE, window.location.href);
    dataUrl.searchParams.set("_", Date.now().toString());
    const r = await fetch(dataUrl, { cache: "no-store" });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    const data = await r.json();
    checkDataFreshness(data);
    updateRfidStatus(data.arduino);
    if (!dataStale) {
      render(data.boxes);
    }
  } catch (e) {
    console.error("DATA LOAD ERROR", e);
    // render NEVOLÁME → layout zůstává zmražený
  }
}

// Funkce pro výpočet čísla týdne (ISO 8601 standard)
function getWeekNumber(d) {
    // Copy date object
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

function updateDateTime() {
  const now = new Date();
  // Sudý/Lichý týden 
  const weekNumber = getWeekNumber(now);
  // Zjistíme, zda je týden sudý (weekNumber % 2 === 0)
  if (weekParityEl) {
    weekParityEl.textContent = (weekNumber % 2 === 0) ? 'SUDÝ TÝDEN' : 'LICHÝ TÝDEN';
  }
  // datum
  dateEl.textContent = now.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  // čas
  timeEl.textContent = now.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  // den v týdnu (PO = 1 ... NE = 0)
  const day = now.getDay(); // 0 = NE, 1 = PO ...
  weekdayEls.forEach(el => {
    el.classList.remove("active");
    if (parseInt(el.dataset.day) === day) {
      el.classList.add("active");
    }
  });
}

function updateRfidStatus(arduino) {
  if (!arduino || !arduino.online) {
    rfidBanner.classList.remove("hidden");
    document.body.classList.add("rfid-offline");
  } else {
    rfidBanner.classList.add("hidden");
    document.body.classList.remove("rfid-offline");
  }
}

function triggerPulse(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow
  el.classList.add(cls);
  // po animaci třídu uklidíme
  setTimeout(() => {
    el.classList.remove(cls);
  }, 900);
  console.log("PULSE:", cls);
}

function render(boxes) {
  boxOrder.forEach((number, i) => {
    const item = boxes[number - 1];
    const isTopRow = i < 5;
    let box = boxesDOM[number];
    // pokud box ještě neexistuje → vytvoříme
    if (!box) {
      box = document.createElement("div");
      box.classList.add("box");
      boxesDOM[number] = box;
      container.appendChild(box);
    }
    // reset tříd
    box.classList.remove("present", "absent", "holiday", "empty");
    box.classList.add("box", item.status);
    // vyčistit obsah
    box.innerHTML = "";
    // ===== animace při změně =====
    const prevState = lastStates[number];
    if (initialized && prevState !== item.status) {
      if (item.status === "present") triggerPulse(box, "pulse-arrive");
      if (item.status === "absent") triggerPulse(box, "pulse-leave");
    }
    // číslo
    const num = document.createElement("div");
    num.classList.add("number", isTopRow ? "top" : "bottom");
    num.innerText = number.toString().padStart(2, "0");
    // jméno
    const name = document.createElement("div");
    name.classList.add("name");
    name.innerText = getTitle(item);
    const spacer = document.createElement("div");
    spacer.style.flexGrow = "1";
    if (isTopRow) {
      box.appendChild(num);
      box.appendChild(name);
    } else {
      box.appendChild(name);
    }
    if (item.status === "present" && item.time) {
      const time = document.createElement("div");
      time.classList.add("time");
      time.innerText = item.time;
      box.appendChild(time);
    }
    box.appendChild(spacer);
    if (!isTopRow) {
      box.appendChild(num);
    }
    lastStates[number] = item.status;
  });
  initialized = true;
}

function getTitle(item) {
  switch (item.status) {
    case "holiday":
      return "SVÁTEK";
    case "empty":
      return "NEOBSAZENO";
    default:
      return item.name || "NEZNÁMÝ";
  }
}

function checkDataFreshness(data) {
  if (!data.generated_at) return;
  const generated = new Date(data.generated_at).getTime();
  const age = Date.now() - generated;
  if (age > DATA_STALE_LIMIT) {
    if (!dataStale) {
      dataStale = true;
      dataBanner.classList.remove("hidden");
      document.body.classList.add("data-stale");
    }
  } else {
    if (dataStale) {
      dataStale = false;
      dataBanner.classList.add("hidden");
      document.body.classList.remove("data-stale");
    }
  }
}

load();
setInterval(load, 2000);
updateDateTime();
setInterval(updateDateTime, 1000);
