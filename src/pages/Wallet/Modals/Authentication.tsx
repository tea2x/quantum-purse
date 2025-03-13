import { Button, Form, Input, Modal, ModalProps } from "antd";
import React, { useImperativeHandle, useState } from "react";
import { useDispatch } from "react-redux";
import { Dispatch } from "../../../store";
import { TEMP_PASSWORD } from "../../../utils/constants";

export interface AuthenticationRef {
  open: () => void;
  close: () => void;
}

interface AuthenticationProps extends ModalProps {}
const Authentication = React.forwardRef<AuthenticationRef, AuthenticationProps>(
  (props, ref) => {
    const [form] = Form.useForm();
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch<Dispatch>();

    const closeHandler = () => {
      setOpen(false);
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: closeHandler,
    }));

    const onFinish = (values: any) => {
      dispatch.wallet.createAccount({ password: values.password });
    };

    return (
      <Modal open={open} {...props} onCancel={closeHandler}>
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
              Generate
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    );
  }
);

export default Authentication;
