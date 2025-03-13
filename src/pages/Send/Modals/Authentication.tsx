import { Button, Form, Input, Modal, ModalProps } from "antd";
import React, { useImperativeHandle, useState } from "react";
import { TEMP_PASSWORD } from "../../../utils/constants";

export interface AuthenticationRef {
  open: () => void;
  close: () => void;
}

interface AuthenticationProps extends ModalProps {
  authenCallback: (password: string) => void;
}
const Authentication = React.forwardRef<AuthenticationRef, AuthenticationProps>(
  ({ authenCallback, ...rest }, ref) => {
    const [form] = Form.useForm();
    const [open, setOpen] = useState(false);

    const closeHandler = () => {
      setOpen(false);
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: closeHandler,
    }));

    const onFinish = (values: any) => {
      authenCallback(values.password);
    };

    return (
      <Modal open={open} {...rest} onCancel={closeHandler} centered>
        <h2>Authentication</h2>
        <p>Please enter your password to generate a new account</p>
        <Form
          form={form}
          onFinish={onFinish}
          initialValues={{ password: TEMP_PASSWORD }}
        >
          <Form.Item name="password" label="Password">
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    );
  }
);

export default Authentication;
