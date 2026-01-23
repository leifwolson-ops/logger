// =====================
// IndexedDB setup
// =====================
let db;
const request = indexedDB.open('TimeDB', 1);

request.onerror = (event) => {
  console.error('Database error:', event.target.error);
};

request.onupgradeneeded = (event) => {
  db = event.target.result;
  db.createObjectStore('times', { keyPath: 'id', autoIncrement: true });
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log('DB ready');
  displayTable();
};

// =====================
// Time textbox logic
// =====================
const timeBox = document.getElementById('timeBox');
let currentID = null;

function formatDate(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Replace "arrived" with current time on focus
timeBox.addEventListener('focus', () => {
  if (timeBox.value === "arrived") {
    timeBox.value = formatDate(new Date());
  }
});

// Save new or updated time on blur
timeBox.addEventListener('blur', () => {
  const newTime = timeBox.value.trim();
  if (!newTime) return;

  const transaction = db.transaction(['times'], 'readwrite');
  const store = transaction.objectStore('times');

  if (currentID === null) {
    // Add new entry
    const requestAdd = store.add({ time: newTime });
    requestAdd.onsuccess = (event) => {
      currentID = event.target.result;
      displayTable();
    };
  } else {
    // Update last entry
    const getRequest = store.get(currentID);
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (!data) return;
      data.time = newTime;
      const updateRequest = store.put(data);
      updateRequest.onsuccess = () => displayTable();
    };
  }
});

// =====================
// Display table
// =====================
function displayTable() {
  if (!db) return;
  const tableBody = document.querySelector('#timeTable tbody');
  tableBody.innerHTML = '';

  const transaction = db.transaction(['times'], 'readonly');
  const store = transaction.objectStore('times');

  store.openCursor().onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${cursor.value.id}</td><td>${cursor.value.time}</td>`;
      tableBody.appendChild(row);
      cursor.continue();
    }
  };
}

// =====================
// Service worker registration
// =====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => console.log('Service Worker Registered'))
    .catch(err => console.error('SW registration failed:', err));
}
