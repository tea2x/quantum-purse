import { Menu, MenuProps } from "antd";
import React, { useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./Sidebar.module.scss";
import LayoutCtx from "../../context/LayoutCtx";

type MenuItem = Required<MenuProps>["items"][number];
const items: MenuItem[] = [
  {
    key: ROUTES.SEND,
    label: <NavLink to={ROUTES.SEND}>Send</NavLink>,
  },
  {
    key: ROUTES.RECEIVE,
    label: <NavLink to={ROUTES.RECEIVE}>Receive</NavLink>,
  },
  {
    key: ROUTES.WALLET,
    label: <NavLink to={ROUTES.WALLET}>My Wallet</NavLink>,
  },
  {
    key: ROUTES.DAO.HOME,
    label: "DAO",
    children: [
      {
        key: ROUTES.DAO.DEPOSIT,
        label: "Deposit",
      },
      {
        key: ROUTES.DAO.WITHDRAW,
        label: "Withdraw",
      },
      {
        key: ROUTES.DAO.UNLOCK,
        label: "Unlock",
      },
    ],
  },
  {
    type: "divider",
  },
  {
    key: ROUTES.SETTINGS.HOME,
    label: "Settings",
    children: [
      { key: ROUTES.SETTINGS.REVEAL_SRP, label: "Reveal SRP" },
      { key: ROUTES.SETTINGS.EJECT_WALLET, label: "Eject Wallet" },
    ],
  },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}
const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();

  return (
    <nav className={cx("panel", styles.sidebar)}>
      <Menu
        mode="inline"
        items={items}
        defaultSelectedKeys={[location.pathname]}
      />
    </nav>
  );
};

export default Sidebar;
