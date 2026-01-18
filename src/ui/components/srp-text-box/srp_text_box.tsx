import { Button, Form, notification } from "antd";
import React, { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Dispatch } from "../../store";
import { formatError } from "../../utils/methods";
import styles from "./srp_text_box.module.scss";
import { ROUTES } from "../../utils/constants";
import { useNavigate } from "react-router-dom";
import { utf8ToBytes } from "../../../core/utils";
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';

interface SrpTextBoxProps {
  value?: string;
  loading?: boolean;
  title?: string;
  description?: string;
  exportSrpHandler: (password: Uint8Array) => Promise<any>;
  onConfirm: () => void;
  isCreateWalletPage?: boolean;
}

const SrpTextBox: React.FC<SrpTextBoxProps> = ({
  value,
  loading = false,
  title = "Secret Recovery Phrase",
  description = "Your secret recovery phrase is a list of 24 words that you can use to recover your wallet.",
  exportSrpHandler,
  onConfirm,
  isCreateWalletPage = false,
}) => {
  const dispatch = useDispatch<Dispatch>();
  const navigate = useNavigate();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordEmpty, setIsPasswordEmpty] = useState(true);

  const onSubmit = async () => {
    if (!passwordInputRef.current) return;

    let passwordBytes: Uint8Array = new Uint8Array(0);
    try {
      passwordBytes = utf8ToBytes(passwordInputRef.current.value);
    } catch (e) {
      throw e;
    } finally {
      if(passwordInputRef.current)
        passwordInputRef.current.value = '';
    }

    try {
      await exportSrpHandler(passwordBytes);
    } catch (error) {
      notification.error({
        message: "Failed to reveal SRP",
        description: formatError(error),
      });
    } finally {
      passwordBytes.fill(0);
      setIsPasswordEmpty(true);
    }
  };

  const handleReset = async () => {
    await dispatch.wallet.ejectWallet();
    navigate(ROUTES.WELCOME);
  };

  // useEffect(() => {
  //   return () => {
  //     dispatch.wallet.resetSRP();
  //   };
  // }, [location]);

  return (
    <div className={styles.srpTextBox}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {description && <p className={styles.description}>{description}</p>}
      {value ? (
        <>
          <div>
            <div
              className={styles.srpArea}
              onCopy={(e) => e.preventDefault()}
            >
              <span className={styles.revealIcon}><EyeOutlined /></span>
              <div className={styles.textBox}>
                <p className="srp">{value}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", width: "fit-content", margin: "0 auto" }}>
            {isCreateWalletPage && (
              <Button
                type="default"
                onClick={handleReset}
              >
                Reset
              </Button>
            )}

            <Button type="primary" onClick={onConfirm}>
              I wrote it down !
            </Button>
          </div>

        </>
      ) : (
        <Form layout="vertical" onFinish={onSubmit}>
          <div className={styles.passwordWrapper}>
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              disabled={loading}
              className={styles.passwordInput}
              onChange={(e) => setIsPasswordEmpty(e.target.value.length === 0)}
            />
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              tabIndex={-1}
            >
              {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            </button>
          </div>

          <Form.Item>
            <div style={{ display: "flex", gap: "8px", width: "fit-content", margin: "0 auto" }}>
              {isCreateWalletPage && (
                <Button
                  type="default"
                  onClick={handleReset}
                >
                  Reset
                </Button>
              )}

              <Button
                type="primary"
                htmlType="submit"
                disabled={isPasswordEmpty || loading}
              >
                Reveal SRP
              </Button>

            </div>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};

export default SrpTextBox;
