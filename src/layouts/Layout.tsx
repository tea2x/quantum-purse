import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import { Dispatch, RootState } from "../store";
import { cx } from "../utils/methods";
import styles from "./Layout.module.scss";
type AuthLayoutProps = React.HTMLAttributes<HTMLDivElement>;

const Layout: React.FC<AuthLayoutProps> = ({
  className,
  children,
  ...rest
}) => {
  const wallet = useSelector((state: RootState) => state.wallet);
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
