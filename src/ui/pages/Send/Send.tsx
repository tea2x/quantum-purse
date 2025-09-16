import {
  Button,
  Flex,
  Form,
  Input,
  notification,
  Tooltip,
  Row,
  Col,
  Modal,
  Space
} from "antd";
import { QuestionCircleOutlined, ScanOutlined, UserSwitchOutlined, SettingFilled } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef, FeeRateSelect } from "../../components";
import { Dispatch, RootState } from "../../store";
import { CKB_DECIMALS } from "../../utils/constants";
import { cx, formatError } from "../../utils/methods";
import styles from "./Send.module.scss";
import QuantumPurse from "../../../core/quantum_purse";
import { Address } from "@ckb-ccc/core";
import { Html5QrcodeScanner } from "html5-qrcode";

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
  const [scannerUp, setScannerUp] = useState(false);
  const [isSendToMyAccount, setIsSendToMyAccount] = useState(false);
  const [isSendMax, setIsSendMax] = useState(false);
  const [isCustomFee, setIsCustomFee] = useState(false);
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
    if (isSendMax && fromAccountBalance) {
      const maxAmount = Number(fromAccountBalance) / CKB_DECIMALS;
      form.setFieldsValue({ amount: maxAmount });
    } else if (isSendMax === false) {
      form.setFieldsValue({ amount: undefined });
    }
  }, [isSendMax, fromAccountBalance]);

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  useEffect(() => {
    if (!scannerUp) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedAddress) => {
        form.setFieldsValue({ to: decodedAddress });
        setScannerUp(false);
        scanner.clear();
      },
      (errorMessage) => {
        console.log(errorMessage);
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerUp]);

  const handleSend = async () => {
    try {
      const txId = isSendMax
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
              <div className="label-with-icon">
                Send To
                <Tooltip title="You can send to any address, or send to yourself by selecting an account from your wallet.">
                  <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </div>
            }
            rules={[
              { required: true, message: "" },
              {
                validator: async (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    await Address.fromString(value, quantumPurse.client);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject("Invalid address");
                  }
                },
              },
            ]}
          >
            {!isSendToMyAccount ? (
              <Space.Compact style={{ display: "flex" }}>
                <Input
                  value={values?.to}
                  placeholder="Input or scan the destination address"
                  style={{ flex: 1, backgroundColor: "var(--gray-light)" }}
                />
                <Button
                  onClick={() => setScannerUp(true)}
                  icon={<ScanOutlined />}
                />
                <Button
                  onClick={() => {
                    setIsSendToMyAccount(!isSendToMyAccount);
                    form.setFieldsValue({ to: undefined }); 
                  }}
                  icon={<UserSwitchOutlined />}
                />
              </Space.Compact>
            ) : (
              <Space.Compact style={{ display: "Flex" }}>
                <AccountSelect
                  accounts={wallet.accounts}
                  placeholder="Please select an account from your wallet"
                  onAccountChange={(val) => form.setFieldsValue({ to: val })}
                />
                <Button
                  onClick={() => {
                    setIsSendToMyAccount(!isSendToMyAccount);
                    form.setFieldsValue({ to: undefined }); 
                  }}
                  icon={<UserSwitchOutlined />}
                />
              </Space.Compact>

            )}
          </Form.Item>

          <Row gutter={14}>
            <Col xs={24} sm={14}>
              <Form.Item
                className={cx("field-to")}
                name="amount"
                label={
                  <div className="label-with-icon">
                    Amount
                  </div>
                }
                rules={[
                  { required: true, message: "" },
                  {
                    validator: (_, value) => {
                      if (
                        !isSendMax &&
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
                <Space.Compact style={{ display: "Flex" }}>
                  <Input
                    value={values?.amount}
                    placeholder="Enter transfer amount"
                    className={styles.inputField}
                    disabled={isSendMax}
                    style={{backgroundColor: "var(--gray-light)"}}
                  />
                  <Button
                    onClick={() => setIsSendMax(!isSendMax)}
                  >
                    Max
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="feeRate"
                className="field-to"
                label={
                  <div className="label-with-icon">
                    Fee Rate
                    <Tooltip title="By default fee rate is set at 1500 shannons/kB. Set a custom fee rate if needed.">
                      <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </div>
                }
              >
                <Space.Compact style={{ display: "Flex" }}>
                  <div style={{ flex: 1 }}>
                    <FeeRateSelect onFeeRateChange={handleFeeRateChange} custom={isCustomFee} />
                  </div>
                  <Button 
                    onClick={() => setIsCustomFee(!isCustomFee)}
                    icon={<SettingFilled />}
                  />
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

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

        <Modal
          open={scannerUp}
          onCancel={() => setScannerUp(false)}
          footer={null}
          title="Scan QR Code"
        >
          <div id="reader" style={{ width: "100%" }} />
        </Modal>

      </div>
    </section>
  );
};

export default Send;