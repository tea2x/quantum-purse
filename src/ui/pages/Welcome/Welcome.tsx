import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.welcome}>
      <h1>Welcome to Quantum Purse</h1>
      <p>Lightweight Client Wallet, Post-Quantum Hardened, Powered by CKB.</p>
      <Button onClick={() => navigate(ROUTES.CREATE_WALLET, {replace: true})}>
        Create a New Wallet
      </Button>
      <Button onClick={() => navigate(ROUTES.IMPORT_WALLET, {replace: true})}>
        Import a Wallet Seed
      </Button>
    </section>
  );
};

export default Welcome;
