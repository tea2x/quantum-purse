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

const currentVersion:string|null = packageJson.version;

const App: React.FC = () => {
  useEffect(() => {
    const prepareMainnetLaunch = async () => {
      let previousVersion:string|null = null;
      try {
        previousVersion = localStorage.getItem('appVersion');
      } catch (error) {
        console.error("Error accessing localStorage:", error);
      }

      function compareVersions(v1: string | null, v2: string): number {
        if (!v1) return -1;
        const parts1 = v1.split(".").map(Number);
        const parts2 = v2.split(".").map(Number);

        const len = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < len; i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 > p2) return 1;
          if (p1 < p2) return -1;
        }
        return 0;
      }

      const fromTestnet = (compareVersions(previousVersion, '0.3.0') === -1);
      const toMainnet = (
        compareVersions(currentVersion, '0.3.0') === 1
        || compareVersions('0.3.0', currentVersion) === 0
      );

      if (fromTestnet && toMainnet) {
        /* Native app (electron) needs a fresh light client db when goes mainnet.
           Demo site doesn't need this because it's always testnet.
           The NATIVE_APP flag is passed into webpack */
        if (process.env.NATIVE_APP === "true") {
          indexedDB.deleteDatabase("data/store");
          indexedDB.deleteDatabase("data/network/peer_store");
        }
        const spxId = localStorage.getItem('sphincs-plus-param-set-id');
        spxId && await DB.setItem(STORAGE_KEYS.SPHINCS_PLUS_PARAM_SET, spxId);
        // localStorage.clear();
      }

      // set current version after check
      (currentVersion !== previousVersion) && localStorage.setItem('appVersion', currentVersion);
    };

    prepareMainnetLaunch();
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