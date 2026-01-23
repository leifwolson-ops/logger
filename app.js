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

timeBox.addEventListener('focus', () => {
  const now = new Date();
  const formattedTime = now.toLocaleString();
  timeBox.value = formattedTime;

  // Add new entry to DB
  const transaction = db.transaction(['times'], 'readwrite');
  const store = transaction.objectStore('times');
  const requestAdd = store.add({ time: formattedTime });

  requestAdd.onsuccess = (event) => {
    currentID = event.target.result; // store ID for potential edits
    displayTable(); // update table after add completes
  };
});

timeBox.addEventListener('blur', () => {
  if (currentID === null) return; // nothing to update
  const newTime = timeBox.value;

  const transaction = db.transaction(['times'], 'readwrite');
  const store = transaction.objectStore('times');
  const getRequest = store.get(currentID);

  getRequest.onsuccess = () => {
    const data = getRequest.result;
    if (!data) return;

    // Only update if value changed
    if (data.time !== newTime) {
      data.time = newTime;
      const updateRequest = store.put(data);
      updateRequest.onsuccess = () => {
        console.log('Time updated:', newTime);
        displayTable(); // refresh table after update
      };
    }
  };
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
