import { Button, Grid, Dropdown, Tooltip } from "antd";
import React, { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LayoutCtx from "../../context/layout_ctx";
import { ROUTES, STORAGE_KEYS } from "../../utils/constants";
import { cx, shortenAddress } from "../../utils/methods";
import Icon from "../icon/icon";
import styles from "./header.module.scss";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { CopyOutlined } from "@ant-design/icons";
import { Copy } from "../../components";

const { useBreakpoint } = Grid;

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
          className={styles.zoomInOut}
          color="var(--white)"
          onClick={() => {
            const step = localStorage.getItem(STORAGE_KEYS.WALLET_STEP);
            if (!step) {
              navigate(ROUTES.HOME);
            }
          }}
        />
        {screens.md && (
          <p className={styles.text}>Quantum Purse</p>
        )}
      </div>

      <div className="header-right">
        <Dropdown
          dropdownRender={() => (
            <div className={styles.syncStatusOverlay}>
              <div className={styles.withOptionalWarningSign}>
                <h2>Peers Information</h2>
                {syncStatus.nodeId === "NULL" && (
                  <Tooltip title="Light client has not started.">
                    <Icon.Alert />
                  </Tooltip>
                )}
              </div>
              <span>Node Id: </span>
              {syncStatus.nodeId && syncStatus.nodeId !== "NULL" ? (
                <Copy value={syncStatus.nodeId} style={{ display: 'inline-block' }}>
                  <span>{shortenAddress(syncStatus.nodeId, 2, 5)}</span>
                  <CopyOutlined className={styles.copyable}/>
                </Copy>
              ) : (
                <span>{syncStatus.nodeId}</span>
              )}
              &nbsp; &nbsp; 
              Connected: {syncStatus && parseInt(syncStatus.connections.toString())} &nbsp; &nbsp; 
              Sync: {syncStatus && syncStatus.syncedStatus.toFixed(2)}%
            </div>
          )}
          trigger={["hover"]}
        >
          <div>
            <Icon.Connections className={styles.spinAndPause}/>
          </div>
        </Dropdown>

        <span className={styles.firstGlance}>
          {syncStatus && parseInt(syncStatus.connections.toString())}
        </span>
        
        <Dropdown
          dropdownRender={() => (
            <div className={styles.syncStatusOverlay}>
              <h2>Network Status</h2>
              Start: {syncStatus && syncStatus.startBlock.toLocaleString()} &nbsp; &nbsp; 
              Synced: {syncStatus && syncStatus.syncedBlock.toLocaleString()} &nbsp; &nbsp; 
              Tip: {syncStatus && syncStatus.tipBlock.toLocaleString()}
            </div>
          )}
          trigger={["hover"]}
        >
          <div>
            <Icon.Syncing className={styles.spinHarmonic}/>
          </div>
        </Dropdown>

        <span className={styles.firstGlance}>
          {syncStatus && syncStatus.syncedStatus.toFixed(2)}%
        </span>
        
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