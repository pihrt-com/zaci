// =====================
// CONFIG
// =====================
const DATA_SOURCE = "https://zaci.pihrt.com/data/status.json";
const DATA_STALE_LIMIT = 20000;

console.log("APP.JS LOADED");
console.log("DATA_SOURCE =", DATA_SOURCE);

// =====================
// DOM ELEMENTS
// =====================
const container     = document.getElementById("container");
const rfidBanner    = document.getElementById("rfid-status");
const dateEl        = document.getElementById("date");
const timeEl        = document.getElementById("time");
const weekdayEls    = document.querySelectorAll(".weekdays span");
const dataBanner    = document.getElementById("data-status");
const weekParityEl  = document.getElementById("week-parity");

// =====================
// DOM DEBUG
// =====================
console.group("DOM CHECK");
console.log("container:", container);
console.log("rfidBanner:", rfidBanner);
console.log("dataBanner:", dataBanner);
console.log("dateEl:", dateEl);
console.log("timeEl:", timeEl);
console.log("weekdayEls count:", weekdayEls.length);
console.log("weekParityEl:", weekParityEl);
console.groupEnd();

// =====================
// STATE
// =====================
const boxOrder = [5,4,3,2,1,6,7,8,9,10];
let lastStates = [];
const boxesDOM = {};
let initialized = false;
let dataStale = false;

// =====================
// LOAD
// =====================
async function load() {
  console.group("LOAD()");
  try {
    console.log("Fetching JSON…");

    // The hosting CDN has previously cached the static file despite fetch's
    // request directive.  A unique URL makes every poll reach the current
    // origin representation; update.php also marks the response as no-store.
    const dataUrl = new URL(DATA_SOURCE);
    dataUrl.searchParams.set("_", Date.now().toString());
    const r = await fetch(dataUrl, { cache: "no-store" });

    console.log("HTTP status:", r.status);

    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }

    const data = await r.json();
    console.log("JSON DATA:", data);

    if (!data) {
      console.error("❌ data is null/undefined");
      return;
    }

    if (!Array.isArray(data.boxes)) {
      console.error("❌ data.boxes is NOT array:", data.boxes);
      return;
    }

    console.log("boxes length:", data.boxes.length);

    checkDataFreshness(data);
    updateRfidStatus(data.arduino);

    console.log("dataStale =", dataStale);

    if (!dataStale) {
      console.log("Calling render()");
      render(data.boxes);
    } else {
      console.warn("DATA STALE → render skipped");
    }

  } catch (e) {
    console.error("❌ DATA LOAD ERROR:", e);
  }
  console.groupEnd();
}

// =====================
// WEEK NUMBER
// =====================
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// =====================
// DATE / TIME
// =====================
function updateDateTime() {
  const now = new Date();

  const weekNumber = getWeekNumber(now);
  if (weekParityEl) {
    weekParityEl.textContent =
      (weekNumber % 2 === 0) ? "SUDÝ TÝDEN" : "LICHÝ TÝDEN";
  }

  dateEl.textContent = now.toLocaleDateString("cs-CZ");
  timeEl.textContent = now.toLocaleTimeString("cs-CZ");

  const day = now.getDay();
  weekdayEls.forEach(el => {
    el.classList.remove("active");
    if (parseInt(el.dataset.day) === day) {
      el.classList.add("active");
    }
  });
}

// =====================
// RFID
// =====================
function updateRfidStatus(arduino) {
  console.log("updateRfidStatus:", arduino);

  if (!arduino || !arduino.online) {
    rfidBanner?.classList.remove("hidden");
    document.body.classList.add("rfid-offline");
  } else {
    rfidBanner?.classList.add("hidden");
    document.body.classList.remove("rfid-offline");
  }
}

// =====================
// RENDER
// =====================
function render(boxes) {
  console.group("RENDER()");
  console.log("boxes:", boxes);

  boxOrder.forEach((number, i) => {
    const item = boxes[number - 1];

    if (!item) {
      console.warn(`Box ${number}: item is undefined`);
      return;
    }

    let box = boxesDOM[number];

    if (!box) {
      box = document.createElement("div");
      box.classList.add("box");
      boxesDOM[number] = box;
      container.appendChild(box);
      console.log(`Created box DOM ${number}`);
    }

    console.log(`Render box ${number}:`, item);

    box.className = `box ${item.status || "empty"}`;
    box.innerHTML = "";

    const prevState = lastStates[number];
    if (initialized && prevState !== item.status) {
      console.log(`State change ${number}: ${prevState} → ${item.status}`);
    }

    const num = document.createElement("div");
    num.className = "number";
    num.innerText = number.toString().padStart(2, "0");

    const name = document.createElement("div");
    name.className = "name";
    name.innerText = getTitle(item);

    box.appendChild(num);
    box.appendChild(name);

    if (item.status === "present" && item.time) {
      const t = document.createElement("div");
      t.className = "time";
      t.innerText = item.time;
      box.appendChild(t);
    }

    lastStates[number] = item.status;
  });

  initialized = true;
  console.groupEnd();
}

// =====================
// HELPERS
// =====================
function getTitle(item) {
  if (!item) return "CHYBA";
  if (item.status === "holiday") return "SVÁTEK";
  if (item.status === "empty") return "NEOBSAZENO";
  return item.name || "NEZNÁMÝ";
}

function checkDataFreshness(data) {
  if (!data.generated_at) {
    console.warn("generated_at missing");
    return;
  }

  const age = Date.now() - new Date(data.generated_at).getTime();
  console.log("Data age (ms):", age);

  if (age > DATA_STALE_LIMIT) {
    if (!dataStale) {
      console.warn("DATA IS STALE");
      dataStale = true;
      dataBanner?.classList.remove("hidden");
      document.body.classList.add("data-stale");
    }
  } else {
    if (dataStale) {
      console.log("DATA OK AGAIN");
      dataStale = false;
      dataBanner?.classList.add("hidden");
      document.body.classList.remove("data-stale");
    }
  }
}

// =====================
// INIT
// =====================
load();
setInterval(load, 2000);
updateDateTime();
setInterval(updateDateTime, 1000);
