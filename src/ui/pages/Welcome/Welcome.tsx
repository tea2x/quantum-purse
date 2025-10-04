import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import styles from "./Welcome.module.scss";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);

  return (
    <section className={styles.welcome}>
      <div className={syncStatus.tipBlock ? styles.statusDotGreen : styles.statusDotRed}></div>
      <div className={styles.header}>
        <h1>WELCOME</h1>
      </div>

      <p className={styles.infoText}>
        Quantum Purse is a non-custodial light-node wallet with post-quantum security from SPHINCS+ and the CKB blockchain.
      </p>

      {/* <Input
        className={styles.emailInput}
        placeholder="e-mail address"
        bordered={false}
      /> */}

      {/* <p className={styles.disclaimer}>
        Your email address is safe with us. We’ll only use it to share
        important product updates — no spam, ever.
      </p> */}

      <div className={styles.footer}>
        <Button
          onClick={() => navigate(ROUTES.CREATE_WALLET, { replace: true })}
          className={styles.ctaButton}
          disabled={!syncStatus.tipBlock}
          loading={!syncStatus.tipBlock}
        >
          NEXT
        </Button>
      </div>
    </section>
  );
};

export default Welcome;
