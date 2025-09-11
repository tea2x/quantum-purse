import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.welcome}>
      {/* Top Section */}
      <div className={styles.header}>
        <h1>WELCOME</h1>
      </div>

      {/* Middle Section */}
      <div className={styles.middle}>
        <p className={styles.infoText}>
          Quantum Purse is a lightweight client wallet, post-quantum hardened and powered by CKB. Learn more about how to get started with your product, receive new
          feature updates and more.
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
      </div>

      {/* Bottom Section */}
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
