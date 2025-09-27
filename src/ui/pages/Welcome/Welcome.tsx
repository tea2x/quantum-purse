import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.welcome}>
      <div className={styles.header}>
        <h1>WELCOME</h1>
      </div>

      <p className={styles.infoText}>
        Quantum Purse is a post-quantum-hardened lightweight wallet powered by the CKB blockchain and SPHINCS+. 
        Learn how to get started, explore new features, and stay up to date with the latest improvements.
      </p>

      <Input
        className={styles.emailInput}
        placeholder="e-mail address"
        bordered={false}
      />

      <p className={styles.disclaimer}>
        Your email address is safe with us. We’ll only use it to share
        important product updates — no spam, ever.
      </p>

      <div className={styles.footer}>
        <Button
          onClick={() => navigate(ROUTES.CREATE_WALLET, { replace: true })}
          className={styles.ctaButton}
        >
          NEXT
        </Button>
      </div>
    </section>
  );
};

export default Welcome;
