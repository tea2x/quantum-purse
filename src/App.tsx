import React, { useEffect } from "react";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import ActiveLayout from "./ui/layouts/ActiveLayout";
import InactiveLayout from "./ui/layouts/InactiveLayout";
import {
  CommingSoon,
  CreateWallet,
  EjectWallet,
  ImportWallet,
  Receive,
  RevealSRP,
  Send,
  Deposit,
  RequestWithdraw,
  Withdraw,
  Accounts,
  Welcome,
} from "./ui/pages";
import { ROUTES, STORAGE_KEYS } from "./ui/utils/constants";
import packageJson from '../package.json';
import { DB } from "./core/db";
import { notification } from "antd";
import { logger } from './core/logger';

const currentVersion:string|null = packageJson.version;

const App: React.FC = () => {
  useEffect(() => {

    // wasm panic, not catchable in js along with other expected errors
    if (typeof Atomics.waitAsync !== "function") {
      notification.error({
        message: "Unsupported browser",
        description:
          "Your browser does not support Atomics.waitAsync which CKB light client depends on.",
      });
    }
  }, []);

  return (
    <Router basename={"/"}>
      <Routes>
        <Route path={ROUTES.HOME} element={<InactiveLayout />}>
          <Route index element={<Navigate to={ROUTES.WELCOME} />} />
          <Route path={ROUTES.WELCOME} element={<Welcome />} />
          <Route path={ROUTES.CREATE_WALLET} element={<CreateWallet />} />
          <Route path={ROUTES.IMPORT_WALLET} element={<ImportWallet />} />
        </Route>
        <Route path={ROUTES.HOME} element={<ActiveLayout />}>
          <Route path={ROUTES.RECEIVE} element={<Receive />} />
          <Route path={ROUTES.SEND} element={<Send />} />
          <Route path={ROUTES.NERVOS_DAO.DEPOSIT} element={<Deposit />} />
          <Route path={ROUTES.NERVOS_DAO.REQUEST_WITHDRAW} element={<RequestWithdraw />} />
          <Route path={ROUTES.NERVOS_DAO.WITHDRAW} element={<Withdraw />} />
          <Route path={ROUTES.SETTINGS.ACCOUNTS} element={<Accounts />} />
          <Route path={ROUTES.SETTINGS.REVEAL_SRP} element={<RevealSRP />} />
          <Route path={ROUTES.SETTINGS.EJECT_WALLET} element={<EjectWallet />} />
        </Route>
        <Route path={ROUTES.COMING_SOON} element={<CommingSoon />} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} />} />
      </Routes>
    </Router>
  );
};

export default App;