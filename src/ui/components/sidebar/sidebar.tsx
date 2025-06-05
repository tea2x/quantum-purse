import { Menu, MenuProps } from "antd";
import React from "react";
import { useSelector } from "react-redux";
import { NavLink, useLocation } from "react-router-dom";
import { RootState } from "../../store";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import CurrentAccount from "../current-account/current_account";
import styles from "./sidebar.module.scss";
import Icon from "../icon/icon";

type MenuItem = Required<MenuProps>["items"][number];
const items: MenuItem[] = [
  {
    key: ROUTES.WALLET,
    icon: <Icon.Wallet />,
    label: <NavLink to={ROUTES.WALLET}>My Wallet</NavLink>,
  },
  {
    key: ROUTES.SEND,
    icon: <Icon.Send />,
    label: <NavLink to={ROUTES.SEND}>Send</NavLink>,
  },
  {
    key: ROUTES.RECEIVE,
    icon: <Icon.Receive />,
    label: <NavLink to={ROUTES.RECEIVE}>Receive</NavLink>,
  },
  {
    key: ROUTES.DAO.HOME,
    icon: <Icon.Dao />,
    label: "DAO",
    children: [
      {
        key: ROUTES.DAO.DEPOSIT,
        icon: <Icon.Deposit />,
        label: <NavLink to={ROUTES.DAO.DEPOSIT}>Deposit</NavLink>,
      },
      {
        key: ROUTES.DAO.WITHDRAW,
        icon: <Icon.Withdraw />,
        label: <NavLink to={ROUTES.DAO.WITHDRAW}>Withdraw</NavLink>,
      },
      {
        key: ROUTES.DAO.UNLOCK,
        icon: <Icon.Unlock />,
        label: <NavLink to={ROUTES.DAO.UNLOCK}>Unlock</NavLink>,
      },
    ],
  },
  {
    type: "divider",
  },
  {
    key: ROUTES.SETTINGS.HOME,
    icon: <Icon.Settings />,
    label: "Settings",
    children: [
      {
        key: ROUTES.SETTINGS.REVEAL_SRP,
        icon: <Icon.Reveal />,
        label: <NavLink to={ROUTES.SETTINGS.REVEAL_SRP}>Reveal SRP</NavLink>,
      },
      {
        key: ROUTES.SETTINGS.EJECT_WALLET,
        icon: <Icon.Eject />,
        label: (
          <NavLink to={ROUTES.SETTINGS.EJECT_WALLET}>Eject Wallet</NavLink>
        ),
      },
    ],
  },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}
const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();
  const wallet = useSelector((state: RootState) => state.wallet);

  return (
    <nav className={cx("panel", styles.sidebar)}>
      <div className="current-account">
        <CurrentAccount
          address={wallet.current.address!}
          name={wallet.current.name}
          balance={wallet.current.balance!}
        />
      </div>
      <Menu
        mode="inline"
        items={items}
        defaultSelectedKeys={[location.pathname]}
      />
    </nav>
  );
};

export default Sidebar;
