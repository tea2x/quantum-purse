import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ActiveLayout from "./layouts/ActiveLayout";
import InactiveLayout from "./layouts/InactiveLayout";
import {
  CommingSoon,
  CreateWallet,
  ImportWallet,
  Receive,
  Send,
  Wallet,
  Welcome,
} from "./pages";
import { ROUTES } from "./utils/constants";

// Detect if running on Github Pages
const isGithubPages = window.location.hostname.includes("github.io");
const repoName = isGithubPages ? window.location.pathname.split("/")[1] : "";
const basename = isGithubPages ? `/${repoName}` : "/";

const App: React.FC = () => {
  return (
    <Router basename={basename}>
      <Routes>
        <Route path={ROUTES.HOME} element={<InactiveLayout />}>
          <Route index element={<Welcome />} />
          <Route path={ROUTES.WELCOME} element={<Welcome />} />
          <Route path={ROUTES.CREATE_WALLET} element={<CreateWallet />} />
          <Route path={ROUTES.IMPORT_WALLET} element={<ImportWallet />} />
        </Route>
        <Route path={ROUTES.HOME} element={<ActiveLayout />}>
          <Route path={ROUTES.WALLET} element={<Wallet />} />
          <Route path={ROUTES.SEND} element={<Send />} />
          <Route path={ROUTES.RECEIVE} element={<Receive />} />
        </Route>
        <Route path={ROUTES.COMING_SOON} element={<CommingSoon />} />
      </Routes>
    </Router>
  );
};

export default App;
