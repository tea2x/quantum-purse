import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import Icon from "../Icon/Icon";
import styles from "./Header.module.scss";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const Header: React.FC<HeaderProps> = ({ className, ...rest }) => {
  const navigate = useNavigate();
  return (
    <header className={cx(styles.header, className)} {...rest}>
      <div className="header-left">
        <Icon.Chip color="var(--white)" onClick={() => navigate(ROUTES.HOME)} />
        <p className={styles.text}>Quantum Purse</p>
      </div>
    </header>
  );
};

export default Header;
