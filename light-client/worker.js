// worker.js

// import { LightClient, randomSecretKey } from "ckb-light-client-js";
// import networkConfig from "./config.toml";
// const SECRET_KEY_NAME = "ckb-light-client-wasm-demo-secret-key";

self.onmessage = function (event) {
  console.log('Message received from main thread:', event.data);

  // Perform heavy computation or long-running task
  const result = startLightClient(event.data);

  // Send result back to main thread
  self.postMessage(result);
};

function startLightClient(data) {
  // const config = await (await fetch(networkConfig)).text();
  // const client = new LightClient();
  // let secretKey = localStorage.getItem(SECRET_KEY_NAME);
  // if (secretKey === null) {
  //   secretKey = randomSecretKey();
  //   localStorage.setItem(SECRET_KEY_NAME, secretKey);
  // }
  // const enableDebug = localStorage.getItem("debug") !== null;

  // await client.start(
  //   { type: "TestNet", config },
  //   secretKey,
  //   enableDebug ? "debug" : "info"
  // );

  return data;
}
