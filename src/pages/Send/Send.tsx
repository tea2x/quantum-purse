import { Button } from "antd";
import { useDispatch } from "react-redux";
import { Dispatch } from "../../store";
import { cx } from "../../utils/methods";
import styles from "./Send.module.scss";
const Send: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Send</h1>
    </section>
  );
};

export default Send;
