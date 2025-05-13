import { Button, Form, Input, notification } from "antd";
import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { Copy } from "../../components";
import { Dispatch } from "../../store";
import usePasswordValidator from "../../hooks/usePasswordValidator";
import { formatError } from "../../utils/methods";
import styles from "./srp_text_box.module.scss";

interface SrpTextBoxProps {
  value?: string;
  loading?: boolean;
  title?: string;
  description?: string;
  exportSrpHandler: (password: string) => Promise<any>;
  onConfirm: () => void;
}

const SrpTextBox: React.FC<SrpTextBoxProps> = ({
  value,
  loading = false,
  title = "Secret Recovery Phrase",
  description = "Your secret recovery phrase is a list of 24 words that you can use to recover your wallet.",
  exportSrpHandler,
  onConfirm,
}) => {
  const location = useLocation();
  const dispatch = useDispatch<Dispatch>();
  const { rules: passwordRules } = usePasswordValidator();
  const onSubmit = async (values: { password: string }) => {
    try {
      await exportSrpHandler(values.password);
      notification.success({
        message: "SRP revealed successfully",
      });
    } catch (error) {
      notification.error({
        message: "Failed to reveal SRP",
        description: formatError(error),
      });
    }
  };

  useEffect(() => {
    return () => {
      dispatch.wallet.resetSRP();
    };
  }, [location]);

  return (
    <div className={styles.srpTextBox}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {description && <p className={styles.description}>{description}</p>}
      {value ? (
        <>
          <div>
            <div className={styles.textBox}>
              <p className="srp">{value}</p>
            </div>
          </div>
          <Button type="primary" onClick={onConfirm}>
            I wrote it down !
          </Button>
        </>
      ) : (
        <Form layout="vertical" onFinish={onSubmit}>
          <Form.Item name="password" rules={passwordRules}>
            <Input.Password size="large" placeholder="Enter your password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Reveal SRP
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};

export default SrpTextBox;
