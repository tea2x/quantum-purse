import { Button, Input, Modal } from "antd";
import React, { useState } from "react";
import styles from "./delete_wallet_confirm.module.scss";
import { IS_MAIN_NET } from "../../../core/config";

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
            disabled={IS_MAIN_NET ? !isConfirmed : false}
          >
            OK
          </Button>
        </div>
      }
    >
      {IS_MAIN_NET ? (
        <>
          <p style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px' }}>
            To confirm, type "<strong>{confirmationText}</strong>"
          </p>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={(e) => e.preventDefault()}
          />
        </>
      ) : (
        <p style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px' }}>
          Are you sure you want to delete this wallet?
        </p>
      )}
    </Modal>
  );
};

export default DeleteWalletModal;