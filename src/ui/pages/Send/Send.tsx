import { addressToScript } from "@nervosnetwork/ckb-sdk-utils";
import {
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  notification,
  Switch,
} from "antd";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AccountSelect,
  Explore,
} from "../../components";
import { Dispatch, RootState } from "../../store";
import { CKB_DECIMALS, CKB_UNIT } from "../../utils/constants";
import { cx, formatError } from "../../utils/methods";
import styles from "./Send.module.scss";
import QuantumPurse from "../../../core/quantum_purse";
import PasswordModal from "../../components/password-input/password_modal";

const Send: React.FC = () => {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const [submittable, setSubmittable] = useState(false);
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const { send: loadingSend } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );
  const [fromAccountBalance, setFromAccountBalance] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordResolver, setPasswordResolver] = useState<((password: string) => void) | null>(null);
  
  const quantumPurse = QuantumPurse.getInstance();

  // Validate form fields to enable/disable the Send button
  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  // Set the requestPassword callback on the signer
  useEffect(() => {
    if (quantumPurse) {
      quantumPurse.requestPassword = (resolve) => {
        setPasswordResolver(() => resolve);
        setIsPasswordModalOpen(true);
      };
    }
  }, [quantumPurse]);

  // Handle the Send button click
  const handleSend = async () => {
    try {
      const txId = await dispatch.wallet.send({ to: values.to, amount: values.amount });
      form.resetFields();
      notification.success({
        message: "Send transaction successfully",
        description: (
          <div>
            <p>Please check the transaction on the explorer</p>
            <p>
              <Explore.Transaction txId={txId as string} />
            </p>
          </div>
        ),
      });
    } catch (error) {
      notification.error({
        message: "Send transaction failed",
        description: formatError(error),
      });
    }
  };

  // Handle password submission from the modal
  const handlePasswordSubmit = (password: string) => {
    if (passwordResolver) {
      passwordResolver(password);
      setPasswordResolver(null);
    }
    setIsPasswordModalOpen(false);
  };

  // Set the "from" field based on the current wallet address
  useEffect(() => {
    form.setFieldsValue({
      from: wallet.current.address,
    });
  }, [wallet.current.address]);

  // Fetch the account balance
  useEffect(() => {
    if (!wallet.current?.spxLockArgs) return;

    const getBalance = async () => {
      const balance = await dispatch.wallet.getAccountBalance({
        spxLockArgs: wallet.current!.spxLockArgs,
      });
      setFromAccountBalance(balance);
    };

    getBalance();
  }, [wallet, dispatch]);

  // Re-validate fields when balance updates
  useEffect(() => {
    if (fromAccountBalance !== null) {
      form.validateFields(["from"]);
      if (values?.amount) {
        form.validateFields(["amount"]);
      }
    }
  }, [fromAccountBalance, form]);

  return (
    <section className={cx(styles.sendForm, "panel")}>
      <h1>Send</h1>
      <div>
        <Form layout="vertical" form={form} className={styles.sendForm}>
          <Form.Item
            name="to"
            label={
              <div className="label-container">
                To
                <div className="switch-container">
                  My Account
                  <Form.Item
                    name="isSendToMyAccount"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch />
                  </Form.Item>
                </div>
              </div>
            }
            rules={[
              { required: true, message: "Please enter a destination address" },
              {
                validator: (_, value) => {
                  if (!value) {
                    return Promise.resolve();
                  }
                  try {
                    addressToScript(value);
                    return Promise.resolve();
                  } catch (error) {
                    return Promise.reject("Please input a valid address");
                  }
                },
              },
            ]}
            className={cx(
              "field-to",
              values?.isSendToMyAccount && "select-my-account"
            )}
          >
            {!values?.isSendToMyAccount ? (
              <Input placeholder="Input the destination address" />
            ) : (
              <AccountSelect
                accounts={wallet.accounts}
                placeholder="Please select account from your wallet"
              />
            )}
          </Form.Item>
          <Form.Item
            className="amount"
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: "Please input amount" },
              {
                type: "number",
                min: 73,
                message: "Amount must be at least 73 CKB",
              },
              {
                validator: (_, value) => {
                  if (
                    fromAccountBalance &&
                    value &&
                    BigInt(fromAccountBalance) / BigInt(CKB_DECIMALS) < BigInt(value)
                  ) {
                    return Promise.reject("Insufficient balance");
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              step={1}
              addonAfter={CKB_UNIT}
              controls
              placeholder="Amount of tokens"
            />
          </Form.Item>
          <Form.Item>
            <Flex justify="end">
              <Button
                type="primary"
                onClick={handleSend}
                disabled={!submittable || loadingSend}
                loading={loadingSend}
              >
                Send
              </Button>
            </Flex>
          </Form.Item>
        </Form>
        <PasswordModal
          isOpen={isPasswordModalOpen}
          onSubmit={handlePasswordSubmit}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      </div>
    </section>
  );
};

export default Send;