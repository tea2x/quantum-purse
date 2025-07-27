import { addressToScript } from "@nervosnetwork/ckb-sdk-utils";
import {
  Button,
  Flex,
  Form,
  Input,
  notification,
  Switch,
  Tooltip
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef, FeeRateSelect } from "../../components";
import { Dispatch, RootState } from "../../store";
import { CKB_DECIMALS, CKB_UNIT } from "../../utils/constants";
import { cx, formatError } from "../../utils/methods";
import styles from "./Send.module.scss";
import QuantumPurse from "../../../core/quantum_purse";

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
  const [passwordResolver, setPasswordResolver] = useState<{
    resolve: (password: string) => void;
    reject: () => void;
  } | null>(null);
  const [feeRate, setFeeRate] = useState<number | undefined>(undefined);
  const authenticationRef = useRef<AuthenticationRef>(null);

  const quantumPurse = QuantumPurse.getInstance();

  // Validate form fields to enable/disable the Send button
  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  // Set and clean up the requestPassword callback
  useEffect(() => {
    if (quantumPurse) {
      quantumPurse.requestPassword = (resolve, reject) => {
        setPasswordResolver({ resolve, reject });
        authenticationRef.current?.open();
      };
      // Cleanup when leaving send page
      return () => {
        quantumPurse.requestPassword = undefined;
      };
    }
  }, [quantumPurse]);

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

  // Pre-validate fields when balance updates
  useEffect(() => {
    if (fromAccountBalance !== null) {
      form.validateFields(["from"]);
      if (values?.amount) {
        form.validateFields(["amount"]);
      }
    }
  }, [fromAccountBalance, form]);

  // Fill amount when send max
  useEffect(() => {
    if (values?.isMax && fromAccountBalance) {
      const maxAmount = Number(fromAccountBalance) / CKB_DECIMALS;
      form.setFieldsValue({ amount: maxAmount });
    } else if (values?.isMax === false) {
      form.setFieldsValue({ amount: undefined });
    }
  }, [values?.isMax, fromAccountBalance]);

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  const handleSend = async () => {
    try {
      const txId = values?.isMax
        ? await dispatch.wallet.sendAll({ to: values.to, feeRate })
        : await dispatch.wallet.send({ to: values.to, amount: values.amount, feeRate });
      form.resetFields();
      notification.success({
        message: "Send transaction successful",
        description: (
          <div>
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

  // Handle password submission and pass it to QPsigner::signOnlyTransaction
  const authenCallback = async (password: string) => {
    if (passwordResolver) {
      passwordResolver.resolve(password);
      setPasswordResolver(null);
    }
    authenticationRef.current?.close();
  };

  return (
    <section className={cx(styles.sendForm, "panel")}>
      <div>
        <Form layout="vertical" form={form}>
          <Form.Item
            name="to"
            className={cx("field-to", values?.isSendToMyAccount && "select-my-account")}
            label={
              <div className="label-container">
                <div className="label-with-icon">
                  Send To
                  <Tooltip title="You can send to any address, or send to yourself by selecting an account from your wallet.">
                    <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                  </Tooltip>
                </div>
                <div className="switch-container">
                  My Wallet
                  <Form.Item name="isSendToMyAccount" style={{ marginBottom: 0 }}>
                    <Switch size="small"/>
                  </Form.Item>
                </div>
              </div>
            }
            rules={[
              { required: true, message: "Address required!" },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    addressToScript(value);
                    return Promise.resolve();
                  } catch (error) {
                    return Promise.reject("Invalid address");
                  }
                },
              },
            ]}
          >
            {!values?.isSendToMyAccount ? (
              <Input
                placeholder="Input the destination address"
                className={styles.inputField}
              />
            ) : (
              <AccountSelect
                accounts={wallet.accounts}
                placeholder="Please select an account from your wallet"
              />
            )}
          </Form.Item>

          <Form.Item
            className={cx("field-to")}
            name="amount"
            label={
              <div className="label-container">
                <div className="label-with-icon">
                  Amount
                </div>
                <div className="switch-container">
                  Maximum
                  <Form.Item name="isMax" style={{ marginBottom: 0 }}>
                    <Switch size="small"/>
                  </Form.Item>
                </div>
              </div>
            }
            rules={[
              { required: true, message: "Amount required!" },
              {
                validator: (_, value) => {
                  if (
                    !values?.isMax &&
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
            <Input
              placeholder="Enter transfer amount"
              className={styles.inputField}
            />
          </Form.Item>

          <Form.Item
            className={cx("field-to")}
            name="feeRate"
            label="Fee Rate"
          >
            <FeeRateSelect onFeeRateChange={handleFeeRateChange} />
          </Form.Item>

          <Form.Item>
            <Flex justify="end">
              <Button
                type="primary"
                onClick={handleSend}
                disabled={!submittable || loadingSend}
                loading={loadingSend}
                className={styles.sendButton}
              >
                Send
              </Button>
            </Flex>
          </Form.Item>
        </Form>
        <Authentication
          ref={authenticationRef}
          authenCallback={authenCallback}
          title="Transferring CKB"
          afterClose={() => {
            if (passwordResolver) {
              passwordResolver.reject();
              setPasswordResolver(null);
            }
          }}
        />
      </div>
    </section>
  );
};

export default Send;