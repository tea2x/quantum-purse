import { Form, Input, Modal, ModalProps } from "antd";
import React, { useImperativeHandle, useState } from "react";
import { TEMP_PASSWORD } from "../../utils/constants";
import styles from "./Authentication.module.scss";

export interface AuthenticationRef {
  open: () => void;
  close: () => void;
}

interface AuthenticationProps extends ModalProps {
  title?: string;
  description?: string;
  loading?: boolean;
  authenCallback: (password: string) => void;
}

const Authentication = React.forwardRef<AuthenticationRef, AuthenticationProps>(
  (
    {
      authenCallback,
      title = "Authentication",
      description = "Please enter your password to generate a new account",
      loading,
      ...rest
    },
    ref
  ) => {
    const [form] = Form.useForm();
    const [open, setOpen] = useState(false);

    const closeHandler = () => {
      setOpen(false);
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: closeHandler,
    }));

    const onFinish = async (values: any) => {
      await authenCallback(values.password);
    };

    return (
      <Modal
        open={open}
        {...rest}
        onCancel={closeHandler}
        centered
        onOk={form.submit}
        className={styles.authentication}
        confirmLoading={loading}
        cancelButtonProps={{
          disabled: loading,
        }}
        closable={!loading}
      >
        <h2 className="title">{title}</h2>
        <p className="description">{description}</p>
        <Form
          form={form}
          onFinish={onFinish}
          initialValues={{ password: TEMP_PASSWORD }}
          layout="vertical"
          className="form-authentication"
        >
          <Form.Item name="password">
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    );
  }
);

export default Authentication;
