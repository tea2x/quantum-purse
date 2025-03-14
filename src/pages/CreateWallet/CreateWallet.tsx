import { LoadingOutlined } from "@ant-design/icons";
import { Button, Checkbox, Flex, Form, Input, Steps } from "antd";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import QuantumPurse from "../../core/quantum_purse";
import { utf8ToBytes } from "../../core/utils";
import { Dispatch } from "../../store";
import { ROUTES, TEMP_PASSWORD } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./CreateWallet.module.scss";
import { CreateWalletContextType } from "./interface";

const CreateWalletContext = createContext<CreateWalletContextType>({
  currentStep: 0,
  setCurrentStep: () => {},
  next: () => {},
  prev: () => {},
  done: () => {},
  steps: [],
});

const CreateWalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const next = () => {
    setCurrentStep(currentStep + 1);
  };
  const prev = () => {
    setCurrentStep(currentStep - 1);
  };
  const done = () => {
    navigate(ROUTES.HOME);
  };

  const steps = useMemo(
    () => [
      {
        key: "1",
        title: "Create password",
        description: "Create a secure password for your wallet",
        icon: <LoadingOutlined />,
        content: <StepCreatePassword />,
      },
      {
        key: "2",
        title: "Secure Secret Recovery Phrase",
        description: "Save your recovery phrase in a secure location",
        icon: <LoadingOutlined />,
        content: <StepSecureSRP />,
      },
    ],
    []
  );

  return (
    <CreateWalletContext.Provider
      value={{ steps, currentStep, setCurrentStep, next, prev, done }}
    >
      {children}
    </CreateWalletContext.Provider>
  );
};

const CreateWalletContent: React.FC = () => {
  const { steps, currentStep } = useContext(CreateWalletContext);

  return (
    <section className={cx(styles.createWallet, "panel")}>
      <h1>Create a new wallet</h1>
      <Steps current={currentStep} items={steps} />
      <div>{steps[currentStep].content}</div>
    </section>
  );
};

const StepCreatePassword: React.FC = () => {
  const [form] = Form.useForm();
  const { next } = useContext(CreateWalletContext);
  const values = Form.useWatch([], form);
  const dispatch = useDispatch<Dispatch>();
  const [submittable, setSubmittable] = React.useState<boolean>(false);

  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  const entropyValidator = (password: string) => {
    if (!password) {
      return Promise.resolve();
    }
    const passwordBytes = utf8ToBytes(password);
    try {
      QuantumPurse.checkPassword(passwordBytes);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(error as string));
    }
  };

  const onFinish = (values: any) => {
    dispatch.wallet.createWallet({
      password:
        values.password || "my password is easy to crack. Don't use this!",
    });
    next();
  };

  return (
    <div className={styles.stepCreatePassword}>
      <h2>Create password</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          // password: TEMP_PASSWORD,
          // confirmPassword: TEMP_PASSWORD,
          passwordAwareness: true,
        }}
      >
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: "Please input your password!" },
            {
              validator: (_, value) => {
                return entropyValidator(value);
              },
            },
          ]}
        >
          <Input.Password size="large" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm password"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please confirm your password!" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("The passwords do not match!"));
              },
            }),
          ]}
        >
          <Input.Password size="large" />
        </Form.Item>
        <Form.Item>
          <Flex align="center" gap={8}>
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
                      new Error("You must acknowledge this statement!")
                    );
                  },
                },
              ]}
              style={{ marginBottom: 0 }}
            >
              <Checkbox />
            </Form.Item>
            <p>
              I understand that Quantum Purse cannot recover this password for
              me.
            </p>
          </Flex>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={!submittable}>
            Create a new wallet
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

const StepSecureSRP: React.FC = () => {
  const { done } = useContext(CreateWalletContext);
  const srp =
    "lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.";
  const copyToClipboard = () => {
    navigator.clipboard.writeText(srp);
  };
  return (
    <div>
      <h2>Secure Secret Recovery Phrase</h2>
      <p>
        Your secret recovery phrase is a list of 12 words that you can use to
        recover your wallet.
      </p>
      <p>
        Write down these 12 words in the order shown below, and store them in a
        secure location.
      </p>
      <p className={styles.srp}>{srp}</p>
      <Flex>
        <Button type="primary" onClick={copyToClipboard}>
          Copy
        </Button>
        <Button onClick={done}>Done</Button>
      </Flex>
    </div>
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
