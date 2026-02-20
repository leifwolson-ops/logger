/* ===========================
   SERVICE WORKER
=========================== */

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});

/* ===========================
   INDEXED DB SETUP
=========================== */

let db;
let logIndex = 1;

const request = indexedDB.open("LoggerDB", 2);

request.onupgradeneeded = function(e) {

  db = e.target.result;
  let logStore;

  if (!db.objectStoreNames.contains("logs")) {

    logStore = db.createObjectStore("logs", {
      keyPath: "index"
    });

  } else {

    logStore = e.target.transaction.objectStore("logs");
  }

  if (!logStore.indexNames.contains("appt_event")) {

    logStore.createIndex(
      "appt_event",
      ["apptTime","event"],
      { unique:false }
    );
  }

  if (!db.objectStoreNames.contains("apptTimes")) {
    db.createObjectStore("apptTimes", { keyPath: "rowId" });
  }
};

request.onsuccess = function(e) {
  db = e.target.result;
  loadApptTimes();
  loadLogs();
};

request.onerror = function() {
  console.error("DB failed to open");
};

/* ===========================
   BUILD ROWS
=========================== */

const panel = document.getElementById("panel");

for (let i = 1; i <= 25; i++) {

  const row = document.createElement("div");
  row.className = "row";
  row.setAttribute("data-row-id", i);

  row.innerHTML = `
    <input type="radio" name="slot">
    <input type="text" inputmode="numeric"
           onblur="saveApptTime(${i}, this.value)">
  `;

  panel.appendChild(row);
}

/* ===========================
   TIME CONVERTER
=========================== */

function convertTypedTime(text) {

  text = text.trim();
  if (!/^\d{3,4}$/.test(text)) return null;

  let hour = text.length === 3
    ? Number(text[0])
    : Number(text.slice(0,2));

  let min = Number(text.slice(-2));
  if (min > 59) return null;

  const am = hour >= 7 && hour <= 11;
  let period = am ? "AM" : "PM";

  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;

  return `${hour}:${String(min).padStart(2,"0")} ${period}`;
}

/* ===========================
   APPT TIMES
=========================== */

function saveApptTime(rowId,value){

  if (!db) return;

  const tx = db.transaction("apptTimes","readwrite");
  const store = tx.objectStore("apptTimes");
  store.put({rowId,value});
}

function loadApptTimes(){

  const tx = db.transaction("apptTimes","readonly");
  const store = tx.objectStore("apptTimes");
  const req = store.getAll();

  req.onsuccess = function(){

    req.result.forEach(item=>{
      const row = document.querySelector(
        `[data-row-id="${item.rowId}"] input[type="text"]`
      );
      if(row) row.value = item.value;
    });
  };
}

/* ===========================
   LOGGING
=========================== */

function getSelectedApptTime(){

  const selected =
    document.querySelector('input[name="slot"]:checked');
  if(!selected) return "";

  const row = selected.closest(".row");
  return row.querySelector('input[type="text"]').value || "";
}

function saveLog(eventName,userInput){

  if(!db || !userInput) return;

  const timestamp = convertTypedTime(userInput);
  if(!timestamp) return;

  const apptTime = getSelectedApptTime();
  if(!apptTime) return;

  const tx = db.transaction("logs","readwrite");
  const store = tx.objectStore("logs");
  const idx = store.index("appt_event");

  const lookup = idx.get([apptTime,eventName]);

  lookup.onsuccess = function(){

    let record = lookup.result;

    if(record){

      record.userInput = userInput;
      record.timestamp = timestamp;

      store.put(record);
      updateRowInTable(record);

    } else {

      record = {
        index: logIndex++,
        apptTime,
        event: eventName,
        userInput,
        timestamp
      };

      store.put(record);
      addRowToTable(record);
    }
  };
}

/* ===========================
   TABLE
=========================== */

function addRowToTable(data){

  const tbody =
    document.querySelector("#logTable tbody");

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${data.index}</td>
    <td>${data.apptTime}</td>
    <td>${data.event}</td>
    <td>${data.userInput}</td>
    <td>${data.timestamp}</td>
  `;

  tbody.appendChild(row);
}

function updateRowInTable(data){

  const rows =
    document.querySelectorAll("#logTable tbody tr");

  rows.forEach(r=>{
    if(Number(r.children[0].textContent)
       === data.index){

      r.children[1].textContent = data.apptTime;
      r.children[2].textContent = data.event;
      r.children[3].textContent = data.userInput;
      r.children[4].textContent = data.timestamp;
    }
  });
}

function loadLogs(){

  const tx = db.transaction("logs","readonly");
  const store = tx.objectStore("logs");
  const req = store.getAll();

  req.onsuccess = function(){

    const logs =
      req.result.sort((a,b)=>a.index-b.index);

    logs.forEach(addRowToTable);

    if(logs.length>0)
      logIndex = logs.at(-1).index + 1;
  };
}

/* ===========================
   EVENT INPUTS
=========================== */

document.getElementById("arrivedOutput")
.addEventListener("blur",function(){
  saveLog("arrived",this.value);
  this.value="";
});

document.getElementById("inOutput")
.addEventListener("blur",function(){
  saveLog("in",this.value);
  this.value="";
});

document.getElementById("outOutput")
.addEventListener("blur",function(){
  saveLog("out",this.value);
  this.value="";
});
