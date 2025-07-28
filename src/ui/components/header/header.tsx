import { Button, Grid } from "antd";
import React, { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LayoutCtx from "../../context/layout_ctx";
import { cx, shortenAddress, formatBalance } from "../../utils/methods";
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
  const MAX_OUT_BOUNDS = 8; // Maximum number of outbound connections in light client config
  
  const screens = useBreakpoint();
  const location = useLocation();
  const balance = wallet.current?.balance;
  const locked = wallet.current?.lockedInDao;
  const noBalance = (balance == "0" && locked == "0");
  const balanceData = noBalance
    ? [
        // fake data for no balance, creating "en empty pie" effect
        { name: "Available", value: 1 },
        { name: "Locked", value: 10**8 },
    ]
    : [
        { name: "Available", value: Number(balance) },
        { name: "Locked", value: Number(locked) },
      ];
  const syncData = [
    { name: "Synced", value: Number(Number(syncStatus?.syncedStatus).toFixed(2)) || 0 },
    { name: "Remaining", value: Number(Number(100 - (syncStatus?.syncedStatus || 0)).toFixed(2)) },
  ];
  const peersData = [
    { name: "Connected", value: Number(Number(syncStatus?.connections).toFixed(2)) || 0 },
    { name: "Waiting", value: Number(Number(MAX_OUT_BOUNDS - (syncStatus?.connections || 0)).toFixed(2)) },
  ];

  useEffect(() => {
    if ("md" in screens && !screens.md) {
      setShowSidebar(false);
    }
  }, [location.pathname, screens.md]);

  // Define scaling factor and dynamic sizes for mobile view
  const scalingFactor = screens.md ? 1 : 0.8;
  const pieChartSize = 90 * scalingFactor;
  const innerRadius = 25 * scalingFactor;
  const outerRadius = 45 * scalingFactor;
  const fontSize = Math.round(12 * scalingFactor);
  const tooltipFontSize = Math.round(10 * scalingFactor);
  const labelStyle = {
    fontSize: `${fontSize}px`,
    fontWeight: 'bold',
  };

  return (
    <header className={cx(styles.header, className)} {...rest}>
      <>
        <div className={styles.statusSection}>
          <PieChart width={pieChartSize} height={pieChartSize}>
            <Pie
              data={balanceData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              animationDuration={500}
              animationEasing="ease-in-out"
              animationBegin={10}
              stroke="none"
            >
              <Cell fill="#00B27A" />
              <Cell fill="#444" />
              <Label
                value="CKB"
                position="center"
                fill="var(--gray-01)"
                style={labelStyle}
              />
            </Pie>
            {!screens.md && !noBalance && (
              <RechartsTooltip
                formatter={(value, name) => `${(Number(value)/10**8).toFixed(0)} CKB`}
                contentStyle={{ fontSize: `${tooltipFontSize}px` }}
              />
            )}
          </PieChart>
          {screens.md && (
            <div className={styles.statusDetails}>
              <span>{wallet.current.name}</span>
              <span>Available: {formatBalance(balance as string)}</span>
              <span>Deposited: {formatBalance(locked as string)}</span>
            </div>
          )}

          
        </div>

        <div className={styles.statusSection}>
          <PieChart width={pieChartSize} height={pieChartSize}>
            <Pie
              data={syncData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              animationDuration={2000}
              animationEasing="ease-in-out"
              animationBegin={20}
              stroke="none"
            >
              <Cell fill="#2196F3" />
              <Cell fill="#444" />
              <Label
                value={`${syncStatus && syncStatus.syncedStatus.toFixed(0)}%`}
                position="center"
                fill="var(--gray-01)"
                style={labelStyle}
              />
            </Pie>
            {!screens.md && (
              <RechartsTooltip
                formatter={(value, name) => `${value}`}
                contentStyle={{ fontSize: `${tooltipFontSize}px` }}
              />
            )}
          </PieChart>
          {screens.md && (
            <div className={styles.statusDetails}>
              <span>Tip: {syncStatus && syncStatus.tipBlock.toLocaleString()}</span>
              <span>Synced: {syncStatus && syncStatus.syncedBlock.toLocaleString()}</span>
              <span>Start: {syncStatus && syncStatus.startBlock.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className={styles.statusSection}>
          <PieChart width={pieChartSize} height={pieChartSize}>
            <Pie
              data={peersData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              animationDuration={500}
              animationEasing="ease-in-out"
              animationBegin={20}
              stroke="none"
            >
              <Cell fill="#f9652f" />
              <Cell fill="#444" />
              <Label
                value="P2P"
                position="center"
                fill="var(--gray-01)"
                style={labelStyle}
              />
            </Pie>
            {!screens.md && (
              <RechartsTooltip
                formatter={(value, name) => `${value}`}
                contentStyle={{ fontSize: `${tooltipFontSize}px` }}
              />
            )}
          </PieChart>
          {screens.md && (
            <div className={styles.statusDetails}>
              <div>
                Id: {" "}
                {syncStatus.nodeId && syncStatus.nodeId !== "NULL" ? (
                  <Copy value={syncStatus.nodeId} style={{ display: 'inline-block' }}>
                    <span className={styles.copyable}>{shortenAddress(syncStatus.nodeId, 3, 5)}</span>
                  </Copy>
                ) : (
                  <span>{syncStatus.nodeId}</span>
                )}
              </div>
              <span>Connected: {parseInt(syncStatus.connections.toString())} / {MAX_OUT_BOUNDS}</span>
            </div>
          )}
        </div>
      </>

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