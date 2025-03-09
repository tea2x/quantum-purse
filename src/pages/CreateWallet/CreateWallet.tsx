import { LoadingOutlined } from "@ant-design/icons";
import { Button, Checkbox, Flex, Form, Input, Steps } from "antd";
import React, { createContext, useContext, useMemo, useState } from "react";
import { cx } from "../../utils/methods";
import styles from "./CreateWallet.module.scss";
import { CreateWalletContextType } from "./interface";
import { ROUTES } from "../../utils/constants";
import { useNavigate } from "react-router-dom";
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
  const onFinish = (values: any) => {
    console.log(values);
    next();
  };

  return (
    <div>
      <h2>Create password</h2>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="password" label="Password">
          <Input.Password />
        </Form.Item>
        <Form.Item name="confirmPassword" label="Confirm password">
          <Input.Password />
        </Form.Item>
        <Form.Item name="passwordAwareness">
          <Flex align="center" gap={8}>
            <Checkbox />
            <p>
              I understand that Quantum Purse cannot recover this password for
              me.
            </p>
          </Flex>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
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
