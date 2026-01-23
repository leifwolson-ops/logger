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
  displayTable(); // Show initial contents when DB is ready
};

// =====================
// Time textbox logic
// =====================
const timeBox = document.getElementById('timeBox');
let currentID = null; // Track last inserted/edited ID

// Helper: validate date/time string
function isValidDateTime(str) {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

// Optional: pre-fill textbox with current time on focus
timeBox.addEventListener('focus', () => {
  if (!timeBox.value) { // only if empty
    const now = new Date();
    timeBox.value = now.toLocaleString();
  }
  // reset background color
  timeBox.style.backgroundColor = '';
});

// Handle blur (focus leaves textbox)
timeBox.addEventListener('blur', () => {
  const newTime = timeBox.value.trim();

  // Validate date/time
  if (!isValidDateTime(newTime)) {
    timeBox.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'; // red tint
    return; // do not update DB
  }

  // Value is valid, reset background
  timeBox.style.backgroundColor = '';

  const transaction = db.transaction(['times'], 'readwrite');
  const store = transaction.objectStore('times');

  if (currentID === null) {
    // No previous entry → add new
    const requestAdd = store.add({ time: newTime });
    requestAdd.onsuccess = (event) => {
      currentID = event.target.result; // store ID for edits
      displayTable();
    };
  } else {
    // Existing entry → update
    const getRequest = store.get(currentID);
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (!data) return;
      if (data.time !== newTime) {
        data.time = newTime;
        const updateRequest = store.put(data);
        updateRequest.onsuccess = () => displayTable();
      }
    };
  }
});

// =====================
// Display table of DB contents
// =====================
function displayTable() {
  if (!db) return; // DB not ready yet

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
