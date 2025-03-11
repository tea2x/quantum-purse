import React from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { Header, Sidebar } from "../components";
import { RuntimeRootState } from "../store/types";
import { ROUTES } from "../utils/constants";
import Layout from "./Layout";

type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const ActiveLayout: React.FC<AuthLayoutProps> = ({ ...rest }) => {
  const wallet = useSelector<RuntimeRootState>((state) => state.wallet);

  if (!wallet.active) {
    return <Navigate to={ROUTES.WELCOME} />;
  }

  return (
    <Layout {...rest}>
      <Header />
      <Sidebar />
      <Outlet />
    </Layout>
  );
};

export default ActiveLayout;
