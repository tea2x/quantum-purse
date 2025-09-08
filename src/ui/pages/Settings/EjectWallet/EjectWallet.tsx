import { Button } from "antd";
import { useDispatch } from "react-redux";
import { Dispatch } from "../../../store";
import { cx } from "../../../utils/methods";
import styles from "./EjectWallet.module.scss";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../utils/constants";
import React, { useState } from "react";
import ConfirmDeleteWalletModal from "../../../components/delete-wallet-confirm/delete_wallet_confirm";

const EjectWallet: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<Dispatch>();
    const [isDeleteWalletConfirmModalOpen, setIsDeleteWalletConfirmModalOpen] = useState(false);

  return (
    <section className={cx(styles.ejectWallet, "panel")}>
      {/* <h1>Eject Wallet</h1> */}
      <div className={styles.content}>
        <p>WARNING! This action removes all encrypted keys & mnemonic.<br />Be sure to have a backup of your mnemonic phrase!</p>
        <Button 
          type="primary" 
          onClick={() => { setIsDeleteWalletConfirmModalOpen(true); }}
        >
          Eject Wallet
        </Button>
      </div>

      <ConfirmDeleteWalletModal
        isOpen={isDeleteWalletConfirmModalOpen}
        onOk={() => {
          dispatch.wallet.ejectWallet();
          navigate(ROUTES.WELCOME);
        }}
        onCancel={() => setIsDeleteWalletConfirmModalOpen(false)}
      />
    </section>
  );
};

export default EjectWallet;
