import { SrpTextBox } from "../../../components";
import { cx } from "../../../utils/methods";
import styles from "./RevealSRP.module.scss";
import QuantumPurse, { SpxVariant } from "../../../../core/quantum_purse";
import { STORAGE_KEYS } from "../../../utils/constants";
import { DB } from "../../../../core/db";
import { useEffect, useState, useRef } from "react";
import { bytesToUtf8 } from "../../../../core/utils";

const RevealSRP: React.FC = () => {
  const srpRef = useRef<Uint8Array | null>(null);
  const [srpRevealed, setSrpRevealed] = useState(false);
  const [paramSet, setParamSet] = useState<number | null>(null);

  const exportSrpHandler = async (password: Uint8Array) => {
    srpRef.current = await QuantumPurse.getInstance().exportSeedPhrase(password);
    setSrpRevealed(true);
  };

  useEffect(() => {
    return () => {
      if (srpRef.current) {
        srpRef.current.fill(0);
      }
    };
  }, []);

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

  const handleConfirm = () => {
    if (srpRef.current) {
      srpRef.current.fill(0);
      srpRef.current = null;
      setSrpRevealed(false);
    }
  };

  return (
    <section className={cx(styles.revealSrp, "panel")}>
      {/* <h1>Reveal Secret Recovery Phrase</h1> */}
      <div className={styles.content}>
        <p>
          WARNING! Never copy or screenshot! Handwrite is recommended! Backup
          too your chosen SPHINCS+ variant [{SpxVariant[Number(paramSet)]}] with
          the mnemonic!
        </p>
        <SrpTextBox
          value={srpRevealed && srpRef.current ? bytesToUtf8(srpRef.current) : ''}
          exportSrpHandler={exportSrpHandler}
          onConfirm={handleConfirm}
          title=""
          description=""
        />
      </div>
    </section>
  );
};

export default RevealSRP;
