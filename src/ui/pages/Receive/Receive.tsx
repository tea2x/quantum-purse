import { useSelector } from "react-redux";
import { AccountDetail } from "../../components";
import { RootState } from "../../store";
import { cx } from "../../utils/methods";
import styles from "./Receive.module.scss";

const Receive: React.FC = () => {
  const activeAccount = useSelector((state: RootState) => state.wallet.current);
  
  return (
    <section className={cx(styles.receiveContainer, "panel")}>
      {/* <h1>Receive</h1> */}
      <div className={styles.content}>
        <AccountDetail account={activeAccount} />
      </div>
    </section>
  );
};

export default Receive;
