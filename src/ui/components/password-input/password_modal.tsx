// PasswordModal.tsx
import React, { useState } from "react";
import { Modal, Input, Button } from "antd";

interface PasswordModalProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onSubmit, onClose }) => {
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    onSubmit(password);
    setPassword("");
    onClose();
  };

  const handleClose = () => {
    setPassword("");
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          Submit
        </Button>,
      ]}
    >
      <h2>Enter Password</h2>
      <Input.Password
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
    </Modal>
  );
};

export default PasswordModal;