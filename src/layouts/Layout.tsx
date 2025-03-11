import React, { Dispatch, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { Header, Sidebar } from "../components";
import { RuntimeRootState } from "../store/types";
import { ROUTES } from "../utils/constants";
import styles from "./Layout.module.scss";
import { cx } from "../utils/methods";
type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const Layout: React.FC<AuthLayoutProps> = ({
  className,
  children,
  ...rest
}) => {
  const wallet = useSelector<RuntimeRootState>((state) => state.wallet);
  const dispatch = useDispatch<Dispatch>();

  useEffect(() => {
    dispatch.wallet.init();
  }, [dispatch.wallet.init]);

  console.log("Layout log wallet data: ", wallet);
  return (
    <div className={cx(styles.layout, className)} {...rest}>
      <Header />
      <div className="container">{children}</div>
    </div>
  );
};

export default Layout;
