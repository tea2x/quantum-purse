import "antd/dist/reset.css";
import "./styles.css";

import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import App from "./App";
import { AntdProvider } from "./ui/providers/AntdProvider";
import LayoutProvider from "./ui/providers/LayoutProvider";
import { store } from "./ui/store";

const container = document.getElementById("root");
const root = createRoot(container!);

root.render(
  // <React.StrictMode>
  <ReduxProvider store={store}>
    <AntdProvider>
      <LayoutProvider>
        <App />
      </LayoutProvider>
    </AntdProvider>
  </ReduxProvider>
  // </React.StrictMode>
);
