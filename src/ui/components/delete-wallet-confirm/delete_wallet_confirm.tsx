import { Button, Modal } from "antd";
import React from "react";
import styles from "./delete_wallet_confirm.module.scss";

interface DeleteWalletModalProps {
  isOpen: boolean;
  onOk: () => void;
  onCancel: () => void;
}

const DeleteWalletModal: React.FC<DeleteWalletModalProps> = ({
  isOpen,
  onOk,
  onCancel,
}) => {
  return (
    <Modal
      className={styles.deleteWalletModal}
      open={isOpen}
      onCancel={onCancel}
      title="Delete Wallet"
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <Button
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            type="primary"
            onClick={onOk}
          >
            OK
          </Button>
        </div>
      }
    >
      <p>Are you sure you want to delete your wallet?</p>
    </Modal>
  );
};

export default DeleteWalletModal;