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
let populateRequestId = 0;

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
    <input type="text" inputmode="numeric">
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

function getCurrentTimeInput() {
  const now = new Date();
  let hour = now.getHours() % 12;
  if (hour === 0) hour = 12;

  const min = String(now.getMinutes()).padStart(2, "0");
  return `${hour}${min}`;
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

function updateLogApptTimes(oldApptTime,newApptTime){

  if (!db || !oldApptTime || oldApptTime === newApptTime) {
        return;
  }

  const tx = db.transaction("logs", "readwrite");
  const store = tx.objectStore("logs");
  const req = store.getAll();

  req.onsuccess = function(){
    req.result.forEach(record => {
      if(record.apptTime !== oldApptTime) return;

      if(!newApptTime){
        store.delete(record.index);
        removeRowFromTable(record.index);
        return;
      }

      record.apptTime = newApptTime;
      store.put(record);
      updateRowInTable(record);
    });
  };
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

function populateEventInputsForApptTime(apptTime){

  const arrivedInput = document.getElementById("arrivedOutput");
  const inInput = document.getElementById("inOutput");
  const outInput = document.getElementById("outOutput");
  const requestId = ++populateRequestId;

  arrivedInput.value = "";
  inInput.value = "";
  outInput.value = "";

  if(!db || !apptTime) return;

  const tx = db.transaction("logs","readonly");
  const store = tx.objectStore("logs");
  const req = store.getAll();

  req.onsuccess = function(){

    if(requestId !== populateRequestId) return;

    const selectedApptTime = getSelectedApptTime();
    if(selectedApptTime !== apptTime) return;

    const matchingLogs = req.result.filter(log =>
      log.apptTime === apptTime
    );

    matchingLogs.forEach(log => {
      if(log.event === "arrived") arrivedInput.value = log.userInput;
      if(log.event === "in") inInput.value = log.userInput;
      if(log.event === "out") outInput.value = log.userInput;
    });
  };
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

function deleteLog(eventName){

  if(!db) return;

  const apptTime = getSelectedApptTime();
  if(!apptTime) return;

  const tx = db.transaction("logs","readwrite");
  const store = tx.objectStore("logs");
  const idx = store.index("appt_event");

  const lookup = idx.get([apptTime,eventName]);

  lookup.onsuccess = function(){
    const record = lookup.result;
    if(!record) return;

    store.delete(record.index);
    removeRowFromTable(record.index);
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

function removeRowFromTable(index){

  const rows =
    document.querySelectorAll("#logTable tbody tr");

  rows.forEach(r=>{
    if(Number(r.children[0].textContent) === index){
      r.remove();
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

function selectAllText(target){
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;
  if(!target.value) return;

  setTimeout(() => target.select(), 0);
}

function handleEventInputFocus(input,eventName){

  if(!input.value){
    input.value = getCurrentTimeInput();
    saveLog(eventName,input.value);
  }

  selectAllText(input);
}

document.getElementById("arrivedOutput")
.addEventListener("blur",function(){
  if(this.value){
    saveLog("arrived",this.value);
  } else {
    deleteLog("arrived");
  }
});

document.getElementById("inOutput")
.addEventListener("blur",function(){
  if(this.value){
    saveLog("in",this.value);
  } else {
    deleteLog("in");
  }
});

document.getElementById("outOutput")
.addEventListener("blur",function(){
  if(this.value){
    saveLog("out",this.value);
  } else {
    deleteLog("out");
  }
});

document.getElementById("arrivedOutput")
.addEventListener("focus",function(){
  handleEventInputFocus(this,"arrived");
});

document.getElementById("inOutput")
.addEventListener("focus",function(){
  handleEventInputFocus(this,"in");
});

document.getElementById("outOutput")
.addEventListener("focus",function(){
  handleEventInputFocus(this,"out");
});

document.addEventListener("click",function(e){
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;
  selectAllText(target);
});

panel.addEventListener("focusin",function(e){
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;

  target.dataset.previousValue = target.value;
});

panel.addEventListener("focus",function(e){
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;

  const radio = target.closest(".row")?.querySelector('input[type="radio"]');
  if(!radio) return;

  if(!radio.checked) radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles:true }));

  selectAllText(target);
},true);

panel.addEventListener("blur",function(e){
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;

  const rowId = Number(target.closest(".row")?.dataset.rowId || 0);
  if(!rowId) return;

  const oldApptTime = target.dataset.previousValue || "";
  const newApptTime = target.value || "";

  saveApptTime(rowId,newApptTime);
  updateLogApptTimes(oldApptTime,newApptTime);

  const radio = target.closest(".row")?.querySelector('input[type="radio"]');
  if(radio?.checked){
    populateEventInputsForApptTime(newApptTime);
  }

  delete target.dataset.previousValue;
},true);


panel.addEventListener("input",function(e){
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  if(target.type !== "text") return;

  const radio = target.closest(".row")?.querySelector('input[type="radio"]');
  if(!radio?.checked) return;

  populateEventInputsForApptTime(target.value || "");
});

panel.addEventListener("change",function(e){
  if(e.target.matches('input[type="radio"][name="slot"]')){
    const row = e.target.closest(".row");
    const apptTime =
      row?.querySelector('input[type="text"]')?.value || "";

    populateEventInputsForApptTime(apptTime);
  }
});