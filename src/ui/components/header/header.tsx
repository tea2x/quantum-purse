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
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

const { useBreakpoint } = Grid;

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const Header: React.FC<HeaderProps> = ({ className, ...rest }) => {
  const isWalletActive = useSelector((state: RootState) => state.wallet.active);
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);
  const wallet = useSelector((state: RootState) => state.wallet);
  const navigate = useNavigate();
  const { showSidebar, setShowSidebar } = useContext(LayoutCtx);
  const screens = useBreakpoint();
  const location = useLocation();
  const balance = Number((Number(wallet.current?.balance) / 10**8).toFixed(2)) || 0;
  const locked = Number((Number(wallet.current?.lockedInDao) / 10**8).toFixed(2)) || 0;
  const data = [
    { name: "Available", value: balance },
    { name: "Locked", value: locked },
  ];

  useEffect(() => {
    if ("md" in screens && !screens.md) {
      setShowSidebar(false);
    }
  }, [location.pathname, screens.md]);

  return (
    <header className={cx(styles.header, className)} {...rest}>
      <div className="header-left">
        {/* <Icon.Logo
          className={styles.zoomInOut}
          color="var(--white)"
          onClick={() => {
            const step = localStorage.getItem(STORAGE_KEYS.WALLET_STEP);
            if (!step) {
              navigate(ROUTES.HOME);
            }
          }}
        /> */}
        {/* <p className={styles.text}>Quantum Purse</p> */}
        {isWalletActive && (
          <div className={styles.balanceContainer}>
            <PieChart width={125} height={125}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={60}
                dataKey="value"
                animationDuration={600}
                animationEasing="ease-in-out"
                animationBegin={50}
              >
                <Cell fill="#00B27A" />
                <Cell fill="#FF8C00" />
              </Pie>
              <RechartsTooltip formatter={(value, name) => `${value} CKB`} />
            </PieChart>
            {screens.md && (
              <div className={styles.balanceNumbers}>
                <span>Available: {balance} CKB</span>
                <span>Nervos DAO: {locked} CKB</span>
              </div>
            )}
          </div>
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
            {syncStatus.nodeId !== "NULL" ? (
              <Icon.Connections className={styles.spinAndPause}/>
            ) : (
              <Icon.NoConnections/>
            )}
          </div>
        </Dropdown>

        {screens.md && (
          <span className={styles.firstGlance}>
            {syncStatus && parseInt(syncStatus.connections.toString())}
          </span>
        )}
        
        <Dropdown
          dropdownRender={() => (
            <div className={styles.syncStatusOverlay}>
              <h2>Sync Status</h2>
              Start: {syncStatus && syncStatus.startBlock.toLocaleString()} &nbsp; &nbsp; 
              Synced: {syncStatus && syncStatus.syncedBlock.toLocaleString()} &nbsp; &nbsp; 
              Tip: {syncStatus && syncStatus.tipBlock.toLocaleString()}
            </div>
          )}
          trigger={["hover"]}
        >
          <div>
            {syncStatus.nodeId !== "NULL" ? (
              <Icon.Syncing className={styles.spinHarmonic}/>
            ) : (
              <Icon.NoSyncing/>
            )}
          </div>
        </Dropdown>
        {screens.md && (
          <span className={styles.firstGlance}>
            {syncStatus && syncStatus.syncedStatus.toFixed(2)}%
          </span>
        )}
        
        {!screens.md && isWalletActive && (
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