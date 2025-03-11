import "antd/dist/reset.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import App from "./App";
import { AntdProvider } from "./components/providers/AntdProvider";
import { store } from "./store";
import "./styles.css";

const container = document.getElementById("root");
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ReduxProvider store={store}>
      <AntdProvider>
        <App />
      </AntdProvider>
    </ReduxProvider>
  </React.StrictMode>
);
