import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className={cx(styles.welcome, "panel")}>
      <h1>Let's get started</h1>
      <p>Quantum Purse is a secure and easy-to-use wallet for the future.</p>
      <Button onClick={() => navigate(ROUTES.CREATE_WALLET)}>
        Create a new wallet
      </Button>
      <Button onClick={() => navigate(ROUTES.IMPORT_WALLET)}>
        Import an existing wallet
      </Button>
    </section>
  );
};

export default Welcome;
