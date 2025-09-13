import {
  Button,
  Flex,
  Form,
  Input,
  notification,
  Switch,
  Tooltip,
  Row,
  Col,
  Modal,
  Space
} from "antd";
import { QuestionCircleOutlined, ScanOutlined } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef, FeeRateSelect } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { CKB_DECIMALS, CKB_UNIT } from "../../../utils/constants";
import { cx, formatError } from "../../../utils/methods";
import styles from "./Deposit.module.scss";
import QuantumPurse from "../../../../core/quantum_purse";
import { Address } from "@ckb-ccc/core";
import { Html5QrcodeScanner } from "html5-qrcode";

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
    resolve: (password: string) => void;
    reject: () => void;
  } | null>(null);
  const [feeRate, setFeeRate] = useState<number | undefined>(undefined);
  const [scannerUp, setScannerUp] = useState(false);
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
    if (values?.isMax && fromAccountBalance) {
      const maxAmount = Number(fromAccountBalance) / CKB_DECIMALS;
      form.setFieldsValue({ amount: maxAmount });
    } else if (values?.isMax === false) {
      form.setFieldsValue({ amount: undefined });
    }
  }, [values?.isMax, fromAccountBalance]);

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

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  const handleDeposit = async () => {
    try {
      const txId = values?.isMax
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
  const authenCallback = async (password: string) => {
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
              <div className="label-container">

                <div className="label-with-icon">
                  Deposit To
                  <Tooltip title="Be careful! Depositing to an address transfers the deposit's ownership too.">
                    <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                  </Tooltip>
                </div>

                <div className="switch-container">
                  My Wallet
                  <Form.Item name="isDepositToMyAccount" noStyle>
                    <Switch size="small"/>
                  </Form.Item>
                </div>
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
            {!values?.isDepositToMyAccount ? (
              <Space.Compact style={{ display: "Flex" }}>
                <Input
                  placeholder="Input or scan the destination address"
                  style={{ flex: 1, backgroundColor: "var(--gray-light)" }}
                />
                <Button
                  onClick={() => setScannerUp(true)}
                  icon={<ScanOutlined />}
                />
              </Space.Compact>
            ) : (
              <AccountSelect
                accounts={wallet.accounts}
                placeholder="Please select an account from your wallet"
              />
            )}
          </Form.Item>

          <Row gutter={14}>
            <Col xs={24} sm={14}>
              <Form.Item
                className={cx("field-to")} //using the same class for style consistency
                name="amount"
                label={
                  <div className="label-container">

                    <div className="label-with-icon">
                      Amount
                    </div>

                    <div className="switch-container">
                      Maximum
                      <Form.Item name="isMax" noStyle>
                        <Switch size="small"/>
                      </Form.Item>
                    </div>
                  </div>
                }
                rules={[
                  { required: true, message: "" },
                  // { type: "number", min: 114, message: "Deposit amount must be at least 114 CKB" },
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
                  placeholder="Enter deposit amount"
                  className={styles.inputField}
                  disabled={values?.isMax}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="feeRate"
                className="field-to"
                label={
                  <div className="label-container">
                    <div className="label-with-icon">
                      Fee Rate
                      <Tooltip title="By default fee rate is set at 1500 shannons/kB. Set a custom fee rate if needed.">
                        <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </div>
                    <div className="switch-container">
                      Custom
                      <Form.Item name="isCustomFeeRate" noStyle>
                        <Switch size="small"/>
                      </Form.Item>
                    </div>
                  </div>
                }
              >
                <FeeRateSelect onFeeRateChange={handleFeeRateChange} custom={values?.isCustomFeeRate}/>
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
          title="Deposit to the DAO"
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