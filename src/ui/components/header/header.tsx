import { Button, Grid } from "antd";
import React, { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LayoutCtx from "../../context/layout_ctx";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import Icon from "../Icon/Icon";
import styles from "./Header.module.scss";
import { useSelector } from 'react-redux';
import { RootState } from "../../store";
import { STORAGE_KEYS } from "../../utils/constants";

const { useBreakpoint } = Grid;

const PeerValue: React.FC<{ value: number }> = ({ value }) => (
  <span className={styles.blinker}>{value}</span>
);

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const Header: React.FC<HeaderProps> = ({ className, ...rest }) => {
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);
  const navigate = useNavigate();
  const { showSidebar, setShowSidebar } = useContext(LayoutCtx);
  const screens = useBreakpoint();

  const location = useLocation();

  useEffect(() => {
    if ("md" in screens && !screens.md) {
      setShowSidebar(false);
    }
  }, [location.pathname, screens.md]);

  return (
    <header className={cx(styles.header, className)} {...rest}>
      <div className="header-left">
        <Icon.Chip
          color="var(--white)"
          onClick={() => {
            const step = localStorage.getItem(STORAGE_KEYS.WALLET_STEP);
            if (!step) {
              navigate(ROUTES.HOME)
            }
          }}
        />
        {screens.md && <p className={styles.text}>Quantum Purse</p>}
      </div>

      <div className="header-center">
        {!screens.md && syncStatus && (
          <span>
            Peers: <PeerValue value={parseInt(syncStatus.connections.toString())} /> | Sync: {syncStatus.syncedStatus.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="header-right">
        {screens.md && syncStatus && (
          <span>
            Peers connected: <PeerValue value={parseInt(syncStatus.connections.toString())} /> | Sync: {syncStatus.syncedStatus.toFixed(2)}%
          </span>
        )}
        {!screens.md && (
          <Button
            type="text"
            onClick={() => setShowSidebar(!showSidebar)}
            icon={<Icon.Hamburger color="var(--white)" />}
          />
        )}
      </div>
    </header>
  );
};

export default Header;
