import { useDispatch, useSelector } from "react-redux";
import { SrpTextBox } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { cx } from "../../../utils/methods";
import styles from "./RevealSRP.module.scss";
import QuantumPurse, { SpxVariant } from "../../../../core/quantum_purse";
import { STORAGE_KEYS } from "../../../utils/constants";

const RevealSRP: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const srp = useSelector((state: RootState) => state.wallet.srp);
  const exportSrpHandler = async (password: string) => await dispatch.wallet.exportSRP({ password });
  
  let paramSet;
  try {
    paramSet = QuantumPurse.getInstance().getSphincsPlusParamSet();
  } catch (e) {
    const paramId = localStorage.getItem(STORAGE_KEYS.SPHINCS_PLUS_PARAM_SET);
    paramSet = Number(paramId);
  }

  return (
    <section className={cx(styles.revealSRP, "panel")}>
      {/* <h1>Reveal Secret Recovery Phrase</h1> */}
      <div className={styles.content}>
        <p>WARNING! Never copy or screenshot! Only handwrite to backup your mnemonic seed phrase with your chosen SPHINCS+ variant "{SpxVariant[Number(paramSet)]}".</p>
        <SrpTextBox
          value={srp}
          exportSrpHandler={exportSrpHandler}
          onConfirm={() => {
            dispatch.wallet.resetSRP();
          }}
          title=""
          description=""
        />
      </div>
    </section>
  );
};

export default RevealSRP;
