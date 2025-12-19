// This worker constantly every 1 seconds updates sync status to the UI via an interface provided by QuantumPurse class

/* Function to request sync status from the main thread */
function requestSyncStatus() {
  return new Promise((resolve) => {
    // create & request
    const requestId = crypto.randomUUID();
    self.postMessage({ command: "getSyncStatus", requestId });
    // fulfill & remove
    self.addEventListener("message", function handler(event) {
      if (event.data.requestId === requestId) {
        resolve(event.data.data);
        self.removeEventListener("message", handler);
      }
    });
  });
}

/* Start periodic sync status updates every 1 seconds */
async function startSyncStatusUpdates() {
  setInterval(async () => {
    syncStatus = await requestSyncStatus();
    self.postMessage({ type: "syncStatusUpdate", data: syncStatus });
  }, 1000);
}

/* This worker's persistent command receiver */
self.onmessage = async function (event) {
  const { command, requestId } = event.data;
  if (command === "start") {
    startSyncStatusUpdates();
    self.postMessage({ type: "started", requestId });
  }
};