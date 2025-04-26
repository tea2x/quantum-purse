import { Button } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch, RootState } from "../../store";
import { cx } from "../../utils/methods";
import styles from "./EjectWallet.module.scss";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";

const EjectWallet: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<Dispatch>();

  return (
    <section className={cx(styles.ejectWallet, "panel")}>
      <h1>Eject Wallet</h1>
      <div className={styles.content}>
        <p><strong style={{fontSize: '1.1em' }}>Delete Your Wallet</strong></p>
        <p>IMPORTANT! This action removes all keys from Quantum Purse's DB.</p>
        <Button 
          type="primary" 
          onClick={() => { 
            dispatch.wallet.ejectWallet()
            navigate(ROUTES.WELCOME)
          }}
        >
          Eject Wallet
        </Button>
      </div>
    </section>
  );
};

export default EjectWallet;
