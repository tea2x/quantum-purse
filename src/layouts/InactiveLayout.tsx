import React from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { RuntimeRootState } from "../store/types";
import { ROUTES } from "../utils/constants";
import Layout from "./Layout";
import styles from "./Layout.module.scss";
type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const InactiveLayout: React.FC<AuthLayoutProps> = ({ ...rest }) => {
  const wallet = useSelector<RuntimeRootState>((state) => state.wallet);

  if (wallet.active) {
    return <Navigate to={ROUTES.WALLET} />;
  }

  return (
    <Layout className={styles.inactiveLayout} {...rest}>
      <Outlet />
    </Layout>
  );
};

export default InactiveLayout;
