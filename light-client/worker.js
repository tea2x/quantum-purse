// Cached sync status in the worker
let syncStatus = { syncedBlock: 0, topBlock: 0, syncedStatus: 0, startBlock: 0 };

// Function to request sync status from the main thread
function requestSyncStatus() {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).substring(7);
    self.postMessage({ command: "getSyncStatus", requestId });
    self.addEventListener("message", function handler(event) {
      if (event.data.requestId === requestId) {
        resolve(event.data.data);
        self.removeEventListener("message", handler);
      }
    });
  });
}

// Start periodic sync status updates every 5 seconds
async function startSyncStatusUpdates() {
  setInterval(async () => {
    syncStatus = await requestSyncStatus();
  }, 1000);
}

// Handle messages from the main thread
self.onmessage = async function (event) {
  const { command, requestId } = event.data;
  if (command === "start") {
    startSyncStatusUpdates();
    self.postMessage({ type: "started", requestId });
  } else if (command === "getSyncStatus") {
    self.postMessage({ type: "syncStatus", data: syncStatus, requestId });
  }
};