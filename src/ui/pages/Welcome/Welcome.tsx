import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className={cx(styles.welcome, "panel")}>
      <h1>Let's Get Started</h1>
      <p>Protecting Your CKB Assets from Post-Quantum Threats</p>
      <Button onClick={() => navigate(ROUTES.CREATE_WALLET, {replace: true})}>
        Create a new wallet
      </Button>
      <Button onClick={() => navigate(ROUTES.IMPORT_WALLET, {replace: true})}>
        Import an existing wallet
      </Button>
    </section>
  );
};

export default Welcome;
