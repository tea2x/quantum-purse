import { useDispatch, useSelector } from "react-redux";
import { SrpTextBox } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx } from "../../utils/methods";
import styles from "./RevealSRP.module.scss";
import QuantumPurse from "../../../core/quantum_purse";

const wallet = QuantumPurse.getInstance();

const RevealSRP: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const srp = useSelector((state: RootState) => state.wallet.srp);

  const exportSrpHandler = async (password: string) =>
    await dispatch.wallet.exportSRP({ password });

  const description = `IMPORTANT! Back up too your chosen SPHINCS+ variant ${wallet.getSphincsPlusParamSet()}.`;

  return (
    <section className={cx(styles.revealSRP, "panel")}>
      <h1>Reveal SRP</h1>
      <div className={styles.content}>
        <SrpTextBox
          value={srp}
          exportSrpHandler={exportSrpHandler}
          onConfirm={() => {
            dispatch.wallet.resetSRP();
          }}
          title="Reveal Secret Recovery Phrase"
          description={description}
        />
      </div>
    </section>
  );
};

export default RevealSRP;
