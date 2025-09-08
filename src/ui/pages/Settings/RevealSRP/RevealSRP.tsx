import { useDispatch, useSelector } from "react-redux";
import { SrpTextBox } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { cx } from "../../../utils/methods";
import styles from "./RevealSRP.module.scss";
import QuantumPurse, { SpxVariant } from "../../../../core/quantum_purse";
import { STORAGE_KEYS } from "../../../utils/constants";
import { DB } from "../../../../core/db";
import { useEffect, useState } from "react";

const RevealSRP: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const srp = useSelector((state: RootState) => state.wallet.srp);
  const exportSrpHandler = async (password: string) => await dispatch.wallet.exportSRP({ password });
  
  const [paramSet, setParamSet] = useState<number | null>(null);

  useEffect(() => {
    let value: number | null = null;
    try {
      value = QuantumPurse.getInstance().getSphincsPlusParamSet();
      setParamSet(value);
    } catch (e) {
      (async () => {
        const paramId = await DB.getItem(STORAGE_KEYS.SPHINCS_PLUS_PARAM_SET);
        if (paramId !== null) {
          setParamSet(Number(paramId));
        }
      })();
    }
  }, []);

  return (
    <section className={cx(styles.revealSRP, "panel")}>
      {/* <h1>Reveal Secret Recovery Phrase</h1> */}
      <div className={styles.content}>
        <p>WARNING! Never copy or screenshot! Only handwrite to backup your mnemonic phrase with your chosen SPHINCS+ variant [ {SpxVariant[Number(paramSet)]} ].</p>
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
