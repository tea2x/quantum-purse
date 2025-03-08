import React from "react";
import { cx } from "../../utils/methods";
import Icon from "../Icon/Icon";
import styles from "./Header.module.scss";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const Header: React.FC<HeaderProps> = ({ className, ...rest }) => {
  return (
    <header className={cx(styles.header, className)} {...rest}>
      <Icon.Chip />
      Header
    </header>
  );
};

export default Header;
