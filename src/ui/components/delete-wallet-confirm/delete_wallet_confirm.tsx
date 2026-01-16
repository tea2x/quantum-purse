import { Button, Input, Modal } from "antd";
import React, { useState } from "react";
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
  const [inputValue, setInputValue] = useState("");
  const confirmationText = "I have a backup and I want to delete";
  const isConfirmed = inputValue === confirmationText;

  const handleCancel = () => {
    setInputValue("");
    onCancel();
  };

  const handleOk = () => {
    setInputValue("");
    onOk();
  };

  return (
    <Modal
      className={styles.deleteWalletModal}
      open={isOpen}
      onCancel={handleCancel}
      title="Delete Wallet"
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <Button onClick={handleCancel}>
            Cancel
          </Button>

          <Button
            type="primary"
            onClick={handleOk}
            disabled={!isConfirmed}
          >
            OK
          </Button>
        </div>
      }
    >
      <p style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px' }}>
        To confirm, type "<strong>{confirmationText}</strong>"
      </p>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPaste={(e) => e.preventDefault()}
      />
    </Modal>
  );
};

export default DeleteWalletModal;