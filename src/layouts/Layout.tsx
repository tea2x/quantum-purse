import React from "react";
import { Outlet } from "react-router-dom";
import { Header, Sidebar } from "../components";

type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const Layout: React.FC<AuthLayoutProps> = ({ ...rest }) => {
  return (
    <div {...rest}>
      <Header />
      <Sidebar />
      <Outlet />
    </div>
  );
};

export default Layout;
