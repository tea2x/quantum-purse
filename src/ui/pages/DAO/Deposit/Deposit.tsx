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
import { QuestionCircleOutlined, ScanOutlined, ArrowDownOutlined, SettingFilled, FullscreenOutlined } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef, FeeRateSelect } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { CKB_DECIMALS } from "../../../utils/constants";
import { cx, formatError } from "../../../utils/methods";
import styles from "./Deposit.module.scss";
import QuantumPurse from "../../../../core/quantum_purse";
import { Address, fixedPointFrom } from "@ckb-ccc/core";
import { Html5QrcodeScanner } from "html5-qrcode";
import { logger } from '../../../../core/logger';

const Deposit: React.FC = () => {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const [submittable, setSubmittable] = useState(false);
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const { deposit: loadingDeposit } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );
  const [fromAccountBalance, setFromAccountBalance] = useState<string | null>(null);
  const [passwordResolver, setPasswordResolver] = useState<{
    resolve: (password: Uint8Array) => void;
    reject: () => void;
  } | null>(null);
  const [feeRate, setFeeRate] = useState<number | undefined>(undefined);
  const [scannerUp, setScannerUp] = useState(false);
  const [isDepositToMyAccount, setIsDepositToMyAccount] = useState(false);
  const [isDepositMax, setIsDepositMax] = useState(false);
  const [isCustomFee, setIsCustomFee] = useState(false);
  const authenticationRef = useRef<AuthenticationRef>(null);

  const quantumPurse = QuantumPurse.getInstance();

  // Validate form fields to enable/disable the Deposit button
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
      // Cleanup when leaving deposit page
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

  // fill amount when deposit max
  useEffect(() => {
    if (isDepositMax && fromAccountBalance) {
      const maxAmount = Number(fromAccountBalance) / CKB_DECIMALS;
      form.setFieldsValue({ amount: maxAmount });
    } else if (isDepositMax === false) {
      form.setFieldsValue({ amount: undefined });
    }
  }, [isDepositMax, fromAccountBalance]);

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
        form.validateFields(["to"]);
        setScannerUp(false);
        scanner.clear();
      },
      (errorMessage) => {
        logger("info", errorMessage);
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerUp]);

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  const handleDeposit = async () => {
    try {
      const txId = isDepositMax
        ? await dispatch.wallet.depositAll({to: values.to, feeRate})
        : await dispatch.wallet.deposit({to: values.to, amount: values.amount, feeRate});
      form.resetFields();
      notification.success({
        message: "Deposit transaction successful",
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
        message: "Deposit transaction failed",
        description: formatError(error),
      });
    }
  };

  // Handle password submission and pass it to QPsigner::signOnlyTransaction
  const authenCallback = async (password: Uint8Array) => {
    if (passwordResolver) {
      passwordResolver.resolve(password);
      setPasswordResolver(null);
    }
    authenticationRef.current?.close();
  };

  return (
    <section className={cx(styles.depositForm, "panel")}>
      {/* <h1>Deposit</h1> */}
      <div>
        <Form layout="vertical" form={form}>
          <Form.Item
            name="to"
            className={cx("field-to", values?.isDepositToMyAccount && "select-my-account")}
            label={
              <div className="label-with-icon">
                Deposit To
                <Tooltip title="Be careful! Depositing to an address transfers the deposit's ownership too.">
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
            {!isDepositToMyAccount ? (
              <Space.Compact style={{ display: "Flex" }}>
                <Input
                  value={values?.to}
                  placeholder="Input or scan the destination address"
                  style={{ backgroundColor: "var(--gray-light)" }}
                />
                <Button
                  onClick={() => setScannerUp(true)}
                  icon={<ScanOutlined />}
                />
                <Button
                  onClick={() => {
                    setIsDepositToMyAccount(!isDepositToMyAccount);
                    form.setFieldsValue({ to: undefined }); 
                  }}
                  icon={<ArrowDownOutlined />}
                />
              </Space.Compact>
            ) : (
              <Space.Compact style={{ display: "Flex" }}>
                <AccountSelect
                  accounts={wallet.accounts}
                  onAccountChange={(val) => form.setFieldsValue({ to: val })}
                />
                <Button
                  onClick={() => {
                    setIsDepositToMyAccount(!isDepositToMyAccount);
                    form.setFieldsValue({ to: undefined }); 
                  }}
                  icon={<ArrowDownOutlined />}
                />
              </Space.Compact>
            )}
          </Form.Item>

          <Row gutter={14}>
            <Col xs={24} sm={14}>
              <Form.Item
                className={cx("field-to")} //using the same class for style consistency
                name="amount"
                label={
                  <div className="label-with-icon">
                    Amount
                  </div>
                }
                rules={[
                  { required: true, message: "" },
                  // { type: "number", min: 114, message: "Deposit amount must be at least 114 CKB" },
                  {
                    validator: (_, value) => {
                      if (
                        !isDepositMax &&
                        fromAccountBalance &&
                        value &&
                        BigInt(fromAccountBalance) < fixedPointFrom(value)
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
                    placeholder="Enter deposit amount"
                    disabled={isDepositMax}
                    style={{backgroundColor: "var(--gray-light)"}}
                  />
                  <Button
                    onClick={() => setIsDepositMax(!isDepositMax)}
                    icon={<FullscreenOutlined />}
                  />
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
                onClick={handleDeposit}
                disabled={!submittable || loadingDeposit}
                loading={loadingDeposit}
                className={styles.depositButton}
              >
                Deposit
              </Button>
            </Flex>
          </Form.Item>
        </Form>
        <Authentication
          ref={authenticationRef}
          authenCallback={authenCallback}
          title="Make a deposit"
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

export default Deposit;