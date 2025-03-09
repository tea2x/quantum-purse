import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AntdProvider } from "./components/providers/AntdProvider";
import Layout from "./layouts/Layout";
import { CommingSoon, CreateWallet, ImportWallet, Welcome } from "./pages";
import { store } from "./store";
import { ROUTES } from "./utils/constants";

// Detect if running on Github Pages
const isGithubPages = window.location.hostname.includes("github.io");
const repoName = isGithubPages ? window.location.pathname.split("/")[1] : "";
const basename = isGithubPages ? `/${repoName}` : "/";

const App: React.FC = () => {
  return (
    <ReduxProvider store={store}>
      <AntdProvider>
        <Router basename={basename}>
          <Routes>
            <Route path={ROUTES.HOME} element={<Layout />}>
              <Route index element={<Welcome />} />
              <Route path={ROUTES.COMING_SOON} element={<CommingSoon />} />
              <Route path={ROUTES.CREATE_WALLET} element={<CreateWallet />} />
              <Route path={ROUTES.IMPORT_WALLET} element={<ImportWallet />} />
            </Route>
          </Routes>
        </Router>
      </AntdProvider>
    </ReduxProvider>
  );
};

export default App;
