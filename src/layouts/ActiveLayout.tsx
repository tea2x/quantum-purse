import React, { useContext } from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "../components";
import LayoutCtx from "../context/LayoutCtx";
import { RootState } from "../store";
import { ROUTES } from "../utils/constants";
import Layout from "./Layout";
import styles from "./Layout.module.scss";

type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const ActiveLayout: React.FC<AuthLayoutProps> = ({ ...rest }) => {
  const wallet = useSelector((state: RootState) => state.wallet);
  const { showSidebar } = useContext(LayoutCtx);

  if (!wallet.active) {
    return <Navigate to={ROUTES.WELCOME} />;
  }

  return (
    <Layout className={styles.activeLayout} {...rest}>
      {showSidebar && <Sidebar />}
      <Outlet />
    </Layout>
  );
};

export default ActiveLayout;
