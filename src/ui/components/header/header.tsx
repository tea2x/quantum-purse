import { Button, Grid } from "antd";
import React, { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LayoutCtx from "../../context/layout_ctx";
import { cx, shortenAddress } from "../../utils/methods";
import Icon from "../icon/icon";
import styles from "./header.module.scss";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { Copy } from "../../components";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Label } from "recharts";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const Header: React.FC<HeaderProps> = ({ className, ...rest }) => {
  const isWalletActive = useSelector((state: RootState) => state.wallet.active);
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);
  const wallet = useSelector((state: RootState) => state.wallet);
  const { showSidebar, setShowSidebar } = useContext(LayoutCtx);
  const { useBreakpoint } = Grid;
  
  const screens = useBreakpoint();
  const location = useLocation();
  const balance = Number((Number(wallet.current?.balance) / 10**8).toFixed(2)) || 0;
  const locked = Number((Number(wallet.current?.lockedInDao) / 10**8).toFixed(2)) || 0;
  const noBalance = (balance === 0 && locked === 0);
  const balanceData = noBalance
    ? [
        // fake data for no balance, creating "en empty pie" effect
        { name: "Available", value: 1 },
        { name: "Locked", value: 10**8 },
    ]
    : [
        { name: "Available", value: balance },
        { name: "Locked", value: locked },
      ];
  const syncData = [
    { name: "Synced", value: Number(Number(syncStatus?.syncedStatus).toFixed(2)) || 0 },
    { name: "Remaining", value: Number(Number(100 - (syncStatus?.syncedStatus || 0)).toFixed(2)) },
  ];
  const peersData = [
    { name: "Synced", value: Number(Number(syncStatus?.connections).toFixed(2)) || 0 },
    { name: "Remaining", value: Number(Number(8 - (syncStatus?.connections || 0)).toFixed(2)) },
  ];

  useEffect(() => {
    if ("md" in screens && !screens.md) {
      setShowSidebar(false);
    }
  }, [location.pathname, screens.md]);

  return (
    <header className={cx(styles.header, className)} {...rest}>
        {isWalletActive && (
          <>
            <div className={styles.balanceContainer}>
              <PieChart width={125} height={125}>
                <Pie
                  data={balanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={60}
                  dataKey="value"
                  animationDuration={700}
                  animationEasing="ease-in-out"
                  animationBegin={50}
                >
                  <Cell fill="#00B27A" />
                  <Cell fill={noBalance ? "#444" : "#f9652f"} />
                </Pie>
                {!noBalance && (
                  <RechartsTooltip formatter={(value, name) => `${value} CKB`} />
                )}
              </PieChart>
              {screens.md && (
                <div className={styles.balanceNumbers}>
                  <span>{wallet.current.name}</span>
                  <span>Liquid: {balance} CKB</span>
                  <span>DAO: {locked} CKB</span>
                </div>
              )}
            </div>

            <div className={styles.syncContainer}>
              <PieChart width={125} height={125}>
                <Pie
                  data={syncData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                  animationBegin={20}
                >
                  <Cell fill="#2196F3" />
                  <Cell fill="#444" />
                  <Label
                    value={`${syncStatus && syncStatus.syncedStatus.toFixed(2)}%`}
                    position="center"
                    fill="#2196F3"
                    style={{ fontSize: '16px', fontWeight: 'bold' }}
                  />
                </Pie>
                {/* <RechartsTooltip
                  formatter={(value, name) => `${value}`}
                /> */}
              </PieChart>
              {screens.md && (
                <div className={styles.balanceNumbers}>
                  <span>Tip: {syncStatus && syncStatus.tipBlock.toLocaleString()}</span>
                  <span>Synced: {syncStatus && syncStatus.syncedBlock.toLocaleString()}</span>
                  <span>Start: {syncStatus && syncStatus.startBlock.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className={styles.p2pNetworkStatusContainer}>
              <PieChart width={125} height={125}>
                <Pie
                  data={peersData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  animationDuration={200}
                  animationEasing="ease-in-out"
                  animationBegin={200}
                >
                  <Cell fill="#FFEB3B" />
                  <Cell fill="#444" />
                  <Label
                    value={`${(syncStatus.connections / 8 * 100).toFixed(2)}%`}
                    position="center"
                    fill="#2196F3"
                    style={{ fontSize: '16px', fontWeight: 'bold' }}
                  />
                </Pie>
                {/* <RechartsTooltip
                  formatter={(value, name) => `${value}`}
                /> */}
              </PieChart>
              {screens.md && (
                <div className={styles.balanceNumbers}>
                  <div>
                  Node Id: {" "}
                  {syncStatus.nodeId && syncStatus.nodeId !== "NULL" ? (
                    <Copy value={syncStatus.nodeId} style={{ display: 'inline-block' }}>
                      <span className={styles.copyable} >{shortenAddress(syncStatus.nodeId, 5, 3)}</span>
                    </Copy>
                  ) : (
                    <span>{syncStatus.nodeId}</span>
                  )}
                  </div>
                  <span>Peers: {parseInt(syncStatus.connections.toString())}</span>
                </div>
              )}
            </div>
          </>
        )}

        {!screens.md && isWalletActive && (
          <Button
            type="text"
            onClick={() => setShowSidebar(!showSidebar)}
            icon={<Icon.Hamburger color="var(--white) !important" />}
          />
        )}
    </header>
  );
};

export default Header;