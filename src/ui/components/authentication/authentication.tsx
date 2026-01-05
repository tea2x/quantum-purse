import { Form, Modal, ModalProps } from "antd";
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import usePasswordValidator from "../../hooks/usePasswordValidator";
import { Dispatch } from "../../store";
import { ROUTES } from "../../utils/constants";
import styles from "./authentication.module.scss";
import QuantumPurse, { SpxVariant } from "../../../core/quantum_purse";
import { STORAGE_KEYS } from "../../utils/constants";
import ConfirmDeleteWalletModal from "../../components/delete-wallet-confirm/delete_wallet_confirm";
import { DB } from "../../../core/db";
import { utf8ToBytes } from "../../../core/utils";
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';

export interface AuthenticationRef {
  open: () => void;
  close: () => void;
}

interface AuthenticationProps extends ModalProps {
  title?: string;
  description?: string;
  loading?: boolean;
  authenCallback: (password: Uint8Array) => Promise<void>;
}

const Authentication = React.forwardRef<AuthenticationRef, AuthenticationProps>(
  (
    {
      authenCallback,
      title = "Authentication",
      description = "",
      loading,
      ...rest
    },
    ref
  ) => {
    const [form] = Form.useForm();
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [submittable, setSubmittable] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isDeleteWalletConfirmModalOpen, setIsDeleteWalletConfirmModalOpen] = useState(false);
    const [paramSet, setParamSet] = useState<number | null>(null);
    const dispatch = useDispatch<Dispatch>();
    const navigate = useNavigate();

    useEffect(() => {
      let value: number | null = null;
      try {
        value = QuantumPurse.getInstance().getSphincsPlusParamSet();
        setParamSet(value);
      } catch (e) {
        (async () => {
          const paramId = await DB.getItem(STORAGE_KEYS.SPHINCS_PLUS_PARAM_SET);
          if (paramId !== null) {
            setParamSet(Number(paramId));
          }
        })();
      }
    }, []);

    const { rules: passwordRules } = usePasswordValidator(paramSet ?? 0);

    const handlePasswordChange = () => {
      setSubmittable((passwordInputRef.current?.value?.length ?? 0) > 0);
    };

    const closeHandler = () => {
      setOpen(false);
      setIsForgotPassword(false);
      setShowPassword(false);
      if (passwordInputRef.current) {
        passwordInputRef.current.value = '';
      }
      form.resetFields();
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: closeHandler,
    }));

    const onFinish = async () => {
      if (!passwordInputRef.current) return;

      const passwordBytes = utf8ToBytes(passwordInputRef.current.value);
      passwordInputRef.current.value = '';
      
      await authenCallback(passwordBytes);
      form.resetFields();
    };

    const modalOptions = useMemo(() => {
      return {
        okText: isForgotPassword ? "Delete & re-import" : "Submit",
        onOk: isForgotPassword
          ? () => setIsDeleteWalletConfirmModalOpen(true)
          : form.submit,
        cancelText: isForgotPassword ? "Cancel" : "Cancel",
        onCancel: isForgotPassword
          ? () => setIsForgotPassword(false)
          : closeHandler,
        okDisabled: isForgotPassword ? false : !submittable,
      };
    }, [isForgotPassword, submittable]);

    return (
      <>
        <Modal
          open={open}
          {...rest}
          okText={modalOptions.okText}
          onOk={modalOptions.onOk}
          cancelText={modalOptions.cancelText}
          onCancel={modalOptions.onCancel}
          centered
          className={styles.authentication}
          confirmLoading={loading}
          cancelButtonProps={{
            disabled: loading,
          }}
          closable={!loading}
          okButtonProps={{
            disabled: modalOptions.okDisabled,
          }}
        >
          {isForgotPassword ? (
            <>
              <h2 className="title">Forgot Password?</h2>
              <p className="description">
                Restore your wallet by deleting current instance and reimport your secret recovery phrase.
              </p>
            </>
          ) : (
            <>
              <h2 className="title">{title}</h2>
              <p className="description">{description}</p>
              <Form
                form={form}
                onFinish={onFinish}
                layout="vertical"
                className="form-authentication"
                disabled={loading}
              >
                <div className={styles.passwordWrapper}>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    onChange={handlePasswordChange}
                    disabled={loading}
                    className={styles.passwordInput}
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
              </Form>
              <p
                className="forgot-password"
                onClick={() => setIsForgotPassword(true)}
              >
                Forgot password?
              </p>
            </>
          )}
        </Modal>
        <ConfirmDeleteWalletModal
          isOpen={isDeleteWalletConfirmModalOpen}
          onOk={async () => {
            await dispatch.wallet.ejectWallet();
            navigate(ROUTES.WELCOME);
          }}
          onCancel={() => setIsDeleteWalletConfirmModalOpen(false)}
        />
      </>
    );
  }
);

export default Authentication;