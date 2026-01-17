import { KeyOutlined, LoadingOutlined, LockOutlined, EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Checkbox, Flex, Form, notification } from "antd";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { SrpTextBox } from "../../components";
import usePasswordValidator from "../../hooks/usePasswordValidator";
import { Dispatch, RootState } from "../../store";
import {
  STORAGE_KEYS,
  WALLET_STEP,
  WalletStepEnum,
  ROUTES
} from "../../utils/constants";
import { cx, formatError } from "../../utils/methods";
import styles from "./CreateWallet.module.scss";
import { CreateWalletContextType } from "./interface";
import ParamSetSelectorForm from "../../components/sphincs-param-set/param_selector";
import QuantumPurse, { SpxVariant } from "../../../core/quantum_purse";
import { useNavigate } from "react-router-dom";
import { DB } from "../../../core/db";
import { utf8ToBytes } from "../../../core/utils";

const CreateWalletContext = createContext<CreateWalletContextType>({
  currentStep: WALLET_STEP.PASSWORD,
  setCurrentStep: () => {},
  next: () => {},
  prev: () => {},
  done: () => {},
  steps: [],
});

const CreateWalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<WalletStepEnum>(
    location.state?.step || WALLET_STEP.PASSWORD
  );
  const dispatch = useDispatch<Dispatch>();
  const { createWallet: loadingCreateWallet, exportSRP: loadingExportSRP } =
    useSelector((state: RootState) => state.loading.effects.wallet);
  const next = () => {
    const nextStepIndex =
      steps.findIndex((step) => step.key === currentStep) + 1;
    setCurrentStep(steps[nextStepIndex].key);
  };
  const prev = () => {
    const prevStepIndex =
      steps.findIndex((step) => step.key === currentStep) - 1;
    setCurrentStep(steps[prevStepIndex].key);
  };

  useEffect(() => {
    if (location.state?.step) {
      setCurrentStep(location.state.step);
    }
  }, [location.state?.step]);

  const done = async () => {
    try {
      await DB.removeItem(STORAGE_KEYS.WALLET_STEP);
      await dispatch.wallet.init({});
      await dispatch.wallet.loadCurrentAccount({});
      dispatch.wallet.resetSRP();
    } catch (error) {
      notification.error({
        message: "Wallet initialization failed!",
        description: formatError(error),
      });
    }
  };

  const steps = useMemo(
    () => [
      {
        key: WALLET_STEP.PASSWORD,
        title: "Wallet Type & Password",
        description: "Choose a SPHINCS+ parameter set and create a password",
        icon: loadingCreateWallet ? <LoadingOutlined /> : <KeyOutlined />,
        content: <StepCreatePassword />,
      },
      {
        key: WALLET_STEP.SRP,
        title: "Secure Secret Recovery Phrase",
        description: "Back up your SPHINCS+ variant and Mnemonic Seed Phrase",
        icon: loadingExportSRP ? <LoadingOutlined /> : <LockOutlined />,
        content: <StepSecureSRP />,
      },
    ],
    [loadingCreateWallet, loadingExportSRP]
  );

  return (
    <CreateWalletContext.Provider
      value={{
        steps,
        currentStep,
        setCurrentStep,
        next,
        prev,
        done,
      }}
    >
      {children}
    </CreateWalletContext.Provider>
  );
};

const CreateWalletContent: React.FC = () => {
  const { steps, currentStep } = useContext(CreateWalletContext);

  return (
    <section className={cx(styles.createWallet, "panel")}>
      <h1>Create A New Wallet</h1>
      {/* <Steps current={currentStep} items={steps} /> */}
      <div>{steps.find((step) => step.key === currentStep)?.content}</div>
    </section>
  );
};

export const StepCreatePassword: React.FC = () => {
  const [form] = Form.useForm();
  const { next } = useContext(CreateWalletContext);
  const values = Form.useWatch([], form);
  const dispatch = useDispatch<Dispatch>();
  const [submittable, setSubmittable] = React.useState<boolean>(false);
  const { createWallet: loadingCreateWallet, exportSRP: loadingExportSRP } =
    useSelector((state: RootState) => state.loading.effects.wallet);
  const parameterSet = Form.useWatch('parameterSet', form);
  const { rules: passwordRules } = usePasswordValidator(parameterSet);
  const navigate = useNavigate();

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordWarning, setPasswordWarning] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');
  const [passwordsValid, setPasswordsValid] = useState<boolean>(false);

  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  useEffect(() => {
    handlePasswordChange();
  }, [parameterSet]);

  const handlePasswordChange = async () => {
    if (!passwordInputRef.current) return;

    setPasswordError('');
    setPasswordWarning('');

    if (!passwordInputRef.current.value) {
      setPasswordsValid(false);
      return;
    }

    let hasError = false;

    // Reusing password rules that were previously defined for Ant Form.item
    // but now plain html input
    for (const rule of passwordRules) {
      try {
        if (rule.validator) {
          await rule.validator({}, passwordInputRef.current.value);
        }
      } catch (error: any) {
        if (rule.warningOnly) {
          setPasswordWarning(rule.message || error.message || '');
        } else {
          setPasswordError(error.message || String(error));
          hasError = true;
        }
        break;
      }
    }

    if (confirmPasswordInputRef.current?.value) {
      const passwordsMatch = passwordInputRef.current.value === confirmPasswordInputRef.current.value;
      if (!passwordsMatch) {
        setConfirmPasswordError('The passwords do not match!');
      } else {
        setConfirmPasswordError('');
      }
      setPasswordsValid(passwordsMatch && !hasError);
    } else {
      setPasswordsValid(!hasError);
    }
  };

  const handleConfirmPasswordChange = () => {
    if (!passwordInputRef.current || !confirmPasswordInputRef.current) return;

    setConfirmPasswordError('');

    if (!confirmPasswordInputRef.current.value) {
      setPasswordsValid(false);
      return;
    }

    const passwordsMatch = passwordInputRef.current.value === confirmPasswordInputRef.current.value;

    if (!passwordsMatch) {
      setConfirmPasswordError('The passwords do not match!');
    }

    setPasswordsValid(passwordsMatch && !passwordError);
  };

  const onFinish = async (formValues: any) => {
    const parameterSet = formValues.parameterSet;

    if (!passwordInputRef.current) return;

    if (parameterSet) {
      QuantumPurse.getInstance().initKeyVault(parameterSet);
    }
    // store chosen param set to storage, so wallet type retains when refreshed
    await DB.setItem(STORAGE_KEYS.SPHINCS_PLUS_PARAM_SET, parameterSet.toString());

    // Convert to bytes immediately to allow referencing throughout the call stack
    const passwordBytes = utf8ToBytes(passwordInputRef.current.value);

    // each function call to key-vault clears the password bytes buffer, here it is firstly
    // used to create the wallet then to export the SRP. So clone password for the second call
    const clonedPasswordBytes = passwordBytes.slice();

    // Clear the inputs immediately after conversion
    passwordInputRef.current.value = '';
    confirmPasswordInputRef.current!.value = '';

    try {
      await dispatch.wallet
        .createWallet({ password: passwordBytes })
        .then(async () => {
          await dispatch.wallet.exportSRP({ password: clonedPasswordBytes });
        })
        .then(async () => {
          next();
          await DB.setItem(STORAGE_KEYS.WALLET_STEP, WALLET_STEP.SRP.toString());
        });
    } catch (error) {
      notification.error({
        message: "Wallet creation failed!",
        description: formatError(error),
      });
    } finally {
      passwordBytes.fill(0);
      clonedPasswordBytes.fill(0);
    }
  };

  return (
    <div className={styles.stepCreatePassword}>
      <h2>Wallet Type & Password</h2>
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={onFinish}
        initialValues={{ parameterSet: SpxVariant.Sha2256S }}
      >
        
        <ParamSetSelectorForm />

        <div style={{ marginBottom: '1.6rem' }}>
          <label style={{ color: 'var(--gray-01)', marginBottom: '0.8rem', display: 'block' }}>Password</label>
          <div className={styles.passwordWrapper}>
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="Please choose a strong password"
              disabled={loadingCreateWallet || loadingExportSRP}
              className={styles.passwordInput}
              onChange={handlePasswordChange}
            />
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowPassword(!showPassword)}
              disabled={loadingCreateWallet || loadingExportSRP}
              tabIndex={-1}
            >
              {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            </button>
          </div>
          {passwordError && <div style={{ color: '#ff4d4f', fontSize: '1.4rem', marginTop: '0.4rem' }}>{passwordError}</div>}
          {passwordWarning && <div style={{ color: '#faad14', fontSize: '1.4rem', marginTop: '0.4rem' }}>{passwordWarning}</div>}
        </div>

        <div style={{ marginBottom: '1.6rem' }}>
          <label style={{ color: 'var(--gray-01)', marginBottom: '0.8rem', display: 'block' }}>Confirm password</label>
          <div className={styles.passwordWrapper}>
            <input
              ref={confirmPasswordInputRef}
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              disabled={loadingCreateWallet || loadingExportSRP}
              className={styles.passwordInput}
              onChange={handleConfirmPasswordChange}
            />
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loadingCreateWallet || loadingExportSRP}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            </button>
          </div>
          {confirmPasswordError && <div style={{ color: '#ff4d4f', fontSize: '1.4rem', marginTop: '0.4rem' }}>{confirmPasswordError}</div>}
        </div>

        <Form.Item
          name="walletTypeBackup"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(new Error("You must agree to the terms!")),
            },
          ]}
        >
          <Checkbox style={{ color: 'var(--gray-01)' }}>
            I understand I must back up my wallet type with the mnemonic phrase next step.
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="passwordAwareness"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) => {
                if (value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error("You must agree to the terms!")
                );
              },
            },
          ]}
        >
          <Checkbox style={{ color: 'var(--gray-01)' }}>
            I understand that Quantum Purse cannot recover this password if lost.
          </Checkbox>
        </Form.Item>

        <Flex align="center" justify="center" gap={16}>
          <Form.Item>
            <Button
              onClick={() => navigate(ROUTES.WELCOME)}
              disabled={loadingCreateWallet || loadingExportSRP}
            >
              Back
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              htmlType="submit"
              type="primary"
              disabled={!submittable || !passwordsValid || loadingCreateWallet || loadingExportSRP}
              loading={loadingCreateWallet || loadingExportSRP}
            >
              Create
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </div>
  );
};

const StepSecureSRP: React.FC = () => {
  const { done } = useContext(CreateWalletContext);
  const srp = useSelector((state: RootState) => state.wallet.srp);
  const dispatch = useDispatch<Dispatch>();
  const { exportSRP: loadingExportSRP } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );

  const exportSrpHandler = async (password: Uint8Array) => {
    try {
      await dispatch.wallet.exportSRP({ password });
    } finally {
      password.fill(0);
    }
  };

  return (
    <SrpTextBox
      value={srp}
      title={"Secure Secret Recovery Phrase"}
      description={
        srp
          ? "WARNING! Never copy or screenshot!\nOnly handwrite to backup your mnemonic phrase! \n Backup too your chosen SPHINCS+ variant [" + SpxVariant[Number(QuantumPurse.getInstance().getSphincsPlusParamSet())] + "]!"
          : "Your wallet creation process has been interrupted. Please enter your password to reveal your SRP then follow through the process or reset and start again."
      }
      exportSrpHandler={exportSrpHandler}
      onConfirm={() => {
        done();
      }}
      loading={loadingExportSRP}
      isCreateWalletPage={true}
    />
  );
};

const CreateWallet: React.FC = () => {
  return (
    <CreateWalletProvider>
      <CreateWalletContent />
    </CreateWalletProvider>
  );
};

export default CreateWallet;
