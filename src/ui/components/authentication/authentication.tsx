import { Form, Input, Modal, ModalProps } from "antd";
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import usePasswordValidator from "../../hooks/usePasswordValidator";
import { Dispatch } from "../../store";
import { ROUTES } from "../../utils/constants";
import styles from "./authentication.module.scss";
import QuantumPurse from "../../../core/quantum_purse";
import { STORAGE_KEYS, DEMO_PASSWORD } from "../../utils/constants";
import ConfirmDeleteWalletModal from "../../components/delete-wallet-confirm/delete_wallet_confirm";
import { DB } from "../../../core/db";

export interface AuthenticationRef {
  open: () => void;
  close: () => void;
}

interface AuthenticationProps extends ModalProps {
  title?: string;
  description?: string;
  loading?: boolean;
  authenCallback: (password: string) => Promise<void>;
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
    const values = Form.useWatch([], form);
    const [open, setOpen] = useState(false);
    const [submittable, setSubmittable] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isDeleteWalletConfirmModalOpen, setIsDeleteWalletConfirmModalOpen] = useState(false);
    const [paramSet, setParamSet] = useState<number | null>(null);
    const dispatch = useDispatch<Dispatch>();
    const navigate = useNavigate();

    // DEMOING
    useEffect(() => {
      if (open) {
        (async () => {
          await authenCallback(DEMO_PASSWORD);
          closeHandler();
        })();
      }
    }, [open]);


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

    useEffect(() => {
      if (values?.password) {
        form
          .validateFields()
          .then(() => setSubmittable(true))
          .catch(() => setSubmittable(false));
      } else {
        setSubmittable(false);
      }
    }, [form, values]);

    const closeHandler = () => {
      setOpen(false);
      setIsForgotPassword(false);
      form.resetFields();
    };

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: closeHandler,
    }));

    const onFinish = async (values: any) => {
      await authenCallback(values.password);
      form.resetFields();
    };

    const modalOptions = useMemo(() => {
      return {
        okText: isForgotPassword ? "Ok, re-import my wallet" : "Submit",
        onOk: isForgotPassword
          ? () => setIsDeleteWalletConfirmModalOpen(true)
          : form.submit,
        cancelText: isForgotPassword ? "Back to Authentication" : "Cancel",
        onCancel: isForgotPassword
          ? () => setIsForgotPassword(false)
          : closeHandler,
        okDisabled: isForgotPassword ? false : !submittable,
      };
    }, [isForgotPassword, submittable]);

    // FOR DEMOING
    return (
      <>
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