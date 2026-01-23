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
  db.createObjectStore('times', { autoIncrement: true });
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log('DB ready');
};

// =====================
// Time textbox logic
// =====================
const timeBox = document.getElementById('timeBox');

timeBox.addEventListener('focus', () => {
  const now = new Date();
  const formattedTime = now.toLocaleString(); // e.g., "1/23/2026, 11:30:15 AM"
  timeBox.value = formattedTime;

  // Store in IndexedDB
  const transaction = db.transaction(['times'], 'readwrite');
  const store = transaction.objectStore('times');
  store.add({ time: formattedTime, timestamp: now.getTime() });

  transaction.oncomplete = () => {
    console.log('Time saved:', formattedTime);
  };
});

// =====================
// Service worker registration
// =====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => console.log('Service Worker Registered'))
    .catch(err => console.error('SW registration failed:', err));
}
