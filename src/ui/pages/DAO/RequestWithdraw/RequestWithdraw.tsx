import { Button, notification, Form, Switch, Input, Empty, Tooltip, Row, Col, Space, Modal } from "antd";
import { QuestionCircleOutlined, ScanOutlined, ArrowDownOutlined, SettingFilled } from "@ant-design/icons";
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Explore, Authentication, AuthenticationRef, AccountSelect, FeeRateSelect } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { cx, formatError } from "../../../utils/methods";
import styles from "./RequestWithdraw.module.scss";
import QuantumPurse from "../../../../core/quantum_purse";
import { ccc, ClientBlockHeader, Hex } from "@ckb-ccc/core";
import { NERVOS_DAO } from "../../../../core/config";
import { parseEpoch, getProfit } from "../../../../core/epoch";
import { Html5QrcodeScanner } from "html5-qrcode";

const RequestWithdraw: React.FC = () => {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const [daoCells, setDaoCells] = useState<ccc.Cell[]>([]);
  const [passwordResolver, setPasswordResolver] = useState<{
    resolve: (password: string) => void;
    reject: () => void;
  } | null>(null);
  const [feeRate, setFeeRate] = useState<number | undefined>(undefined);
  const [tipHeader, setTipHeader] = useState<ClientBlockHeader | null>(null);
  const [depositEstimatedInfo, setDepositEstimatedInfo] = useState<{
    [key: string]: {
      tilMaxProfit: number;
      currentProfit: number;
      blockNum: bigint;
    };
  }>({});
  const [scannerUp, setScannerUp] = useState(false);
  const [isRequestToMyAccount, setIsRequestToMyAccount] = useState(false);
  const [isCustomFee, setIsCustomFee] = useState(false);
  const authenticationRef = useRef<AuthenticationRef>(null);
  const { requestWithdraw: loadingRequest } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );

  const depositCells = daoCells.filter(cell => cell.outputData === "0x0000000000000000");
  const toError = form.getFieldError('to');
  const isToValid = values?.to && toError.length === 0;

  const quantumPurse = QuantumPurse.getInstance();

  useEffect(() => {
    (async () => {
      if (quantumPurse && quantumPurse.hasClientStarted) {
        const header = await quantumPurse.client.getTipHeader();
        setTipHeader(header);
      }
    })();
  }, [quantumPurse, quantumPurse.hasClientStarted]);

  useEffect(() => {
    if (!tipHeader || daoCells.length === 0 || !quantumPurse.hasClientStarted) return;

    const fetchRemainingDays = async () => {
      const estimatedInfos: { [key: string]: {tilMaxProfit: number, currentProfit: number, blockNum: bigint} } = {};
      for (const cell of depositCells) {
        const key = cell.outPoint.txHash + cell.outPoint.index;
        try {
          await quantumPurse.client.fetchTransaction(cell.outPoint.txHash);
          const depositTx = await quantumPurse.client.getTransaction(cell.outPoint.txHash);
          const depositHeader = await quantumPurse.client.getHeader(depositTx?.blockHash as Hex);
          if (!depositHeader) {
            throw new Error("Unable to retrieve DAO deposit block header at tx: " + cell.outPoint.txHash);
          }
          const remainingEpochs = Number(
            ccc.fixedPointToString(
              parseEpoch(tipHeader.epoch) - parseEpoch(depositHeader.epoch)
            )
          ) % 180;
          const tilMaxProfit = 30 - (remainingEpochs / 180) * 30;
          const currentProfit = Number(getProfit(cell, depositHeader, tipHeader));
          const blockNum = depositHeader.number;
          estimatedInfos[key] = {tilMaxProfit, currentProfit, blockNum};
        } catch (error) {
          console.error('Error calculating remaining days for cell:', cell, error);
          estimatedInfos[key] = {tilMaxProfit: Infinity, currentProfit: 0, blockNum: BigInt(0)};
        }
      }
      setDepositEstimatedInfo(estimatedInfos);
    };

    fetchRemainingDays();
  }, [daoCells, tipHeader, quantumPurse.hasClientStarted]);

  useEffect(() => {
    if (!quantumPurse || !quantumPurse.accountPointer) {
      return;
    }

    (async () => {
      const daos = [];
      for await (const cell of quantumPurse.findCells(
        {
          script: {
            codeHash: NERVOS_DAO.codeHash,
            hashType: NERVOS_DAO.hashType,
            args: "0x"
          },
          scriptLenRange: [33, 34], // 32(codeHash) + 1 (hashType). No arguments.
          outputDataLenRange: [8, 9], // 8 bytes DAO data.
        },
        true,
      )) {
        daos.push(cell);
      }
      setDaoCells(daos);
    })();
  }, [quantumPurse, quantumPurse.accountPointer]);

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
        console.log(errorMessage);
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerUp]);

  // todo update with `depositCell.getNervosDaoInfo` when light client js updates ccc core.
  const getNervosDaoInfo = async (depositCell: ccc.Cell):Promise<{depositHeader: ClientBlockHeader}> => {
    const depositTx = await quantumPurse.client.getTransaction(depositCell.outPoint.txHash);
    const blockHash = depositTx?.blockHash;
    const header = await quantumPurse.client.getHeader(blockHash as Hex);
    if (!header) {
      throw new Error("Unable to retrieve block header!");
    }
    return {depositHeader: header};
  };

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  const handleWithdrawRequest = async (depositCell: ccc.Cell) => {
    try {
      // todo update when light client js updates ccc core.
      const { depositHeader } = await getNervosDaoInfo(depositCell);
      const depositBlockNum = depositHeader.number;
      const depositBlockHash = depositHeader.hash;
      const txId = await dispatch.wallet.requestWithdraw({
        to: values.to,
        depositCell: depositCell,
        depositBlockNum: depositBlockNum,
        depositBlockHash: depositBlockHash,
        feeRate
      });
      notification.success({
        message: "Withdraw request transaction successful",
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
        message: "Withdraw request transaction failed",
        description: formatError(error),
      });
    }
  };

  const authenCallback = async (password: string) => {
    if (passwordResolver) {
      passwordResolver.resolve(password);
      setPasswordResolver(null);
    }
    authenticationRef.current?.close();
  };

  return (
    <section className={cx(styles.withdrawRequestForm, "panel")}>
      <div>
        {(depositCells.length > 0 && Object.keys(depositEstimatedInfo).length !== 0) ? (
          <>
            <div>
              <Form layout="vertical" form={form}>
                <Row gutter={14}>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      name="to"
                      label={
                        <div className="label-with-icon">
                          Request To
                          <Tooltip title="Be careful! Making a withdraw request to an address transfers the request's ownership too.">
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
                              await ccc.Address.fromString(value, quantumPurse.client);
                              return Promise.resolve();
                            } catch (error) {
                              return Promise.reject("Invalid address");
                            }
                          },
                        },
                      ]}
                      className={cx("field-to", isRequestToMyAccount && "select-my-account")}
                    >
                      {!isRequestToMyAccount ? (
                        <Space.Compact style={{ display: "flex" }}>
                          <Input
                            value={values?.to}
                            placeholder="Input or scan the destination address"
                            style={{backgroundColor: "var(--gray-light)"}}
                          />
                          <Button
                            onClick={() => setScannerUp(true)}
                            icon={<ScanOutlined />}
                          />
                          <Button
                            onClick={() => {
                              setIsRequestToMyAccount(!isRequestToMyAccount);
                              form.setFieldsValue({ to: undefined }); 
                            }}
                            icon={<ArrowDownOutlined />}
                          />
                        </Space.Compact>
                      ) : (
                        <Space.Compact style={{ display: "flex" }}>
                          <AccountSelect
                            accounts={wallet.accounts}
                            onAccountChange={(val) => form.setFieldsValue({ to: val })}
                          />
                          <Button
                            onClick={() => {
                              setIsRequestToMyAccount(!isRequestToMyAccount);
                              form.setFieldsValue({ to: undefined }); 
                            }}
                            icon={<ArrowDownOutlined />}
                          />
                        </Space.Compact>
                      )}
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
                      <Space.Compact style={{ display: "flex" }}>
                        <div style={{ flex: 1 }}>
                          <FeeRateSelect onFeeRateChange={handleFeeRateChange} custom={isCustomFee}/>
                        </div>
                        <Button 
                          onClick={() => setIsCustomFee(!isCustomFee)}
                          icon={<SettingFilled />}
                        />
                      </Space.Compact>
                      
                    </Form.Item>
                  </Col>
                </Row>
              </Form>

              <Authentication
                ref={authenticationRef}
                authenCallback={authenCallback}
                title="Make a Withdraw Request from the DAO"
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

            <div className={styles.requestWithdrawListContainer}>
              <ul className={styles.requestWithdrawList}>
                {[...depositCells]
                  .sort((a, b) => {
                    const keyA = a.outPoint.txHash + a.outPoint.index;
                    const keyB = b.outPoint.txHash + b.outPoint.index;
                    const blockNumA = depositEstimatedInfo[keyA]?.blockNum ?? BigInt(0);
                    const blockNumB = depositEstimatedInfo[keyB]?.blockNum ?? BigInt(0);
                    return Number(blockNumB - blockNumA);
                  })
                  .map((cell) => {
                    const key = cell.outPoint.txHash + cell.outPoint.index;
                    const { tilMaxProfit, currentProfit } = depositEstimatedInfo[key] ?? { tilMaxProfit: Infinity, currentProfit: 0 };
                    const progress = Math.max(0, Math.min(1, (30 - tilMaxProfit) / 30));
                    return (
                      <li key={key} className={styles.depositItem}>
                        <div
                          className={styles.progressBackground}
                          style={{ width: `${progress * 100}%` }}
                        ></div>
                        <div className={styles.content}>
                          <span className={styles.capacity}>
                            <div>{(Number(BigInt(cell.cellOutput.capacity)) / 10**8).toFixed(2)} CKB</div>
                            <div>+ {Number((currentProfit / 10**8).toFixed(5))} CKB gained so far</div>
                            <div>Next locking cycle will start in {Number(tilMaxProfit.toFixed(1))} days</div>
                          </span>
                          <Button
                            type="primary"
                            loading={loadingRequest}
                            onClick={() => handleWithdrawRequest(cell)}
                            disabled={!isToValid}
                          >
                            Request
                          </Button>
                        </div>
                      </li>
                    );
                  })
                }
              </ul>
            </div>
          </>
        ) : (
          <div className={styles.requestWithdrawListContainer}>
            <Empty
              description={
                <span style={{ color: 'var(--gray-light)', fontFamily: 'Sora, sans-serif' }}>
                  No deposits found to make a request from! 🫠
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className={styles.emptyList}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default RequestWithdraw;