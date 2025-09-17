import { Button, notification, Form, Switch, Input, Empty, Tooltip, Row, Col } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef, FeeRateSelect } from "../../../components";
import { Dispatch, RootState } from "../../../store";
import { cx, formatError } from "../../../utils/methods";
import styles from "./Withdraw.module.scss";
import QuantumPurse from "../../../../core/quantum_purse";
import { ccc, ClientBlockHeader, Hex } from "@ckb-ccc/core";
import { NERVOS_DAO } from "../../../../core/config";
import { parseEpoch, getClaimEpoch, getProfit } from "../../../../core/epoch";

const Withdraw: React.FC = () => {
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
  const [redeemingInfos, setRedeemingInfos] = useState<{
    [key: string]: {
      remain: number; 
      profit: number;
      blockNum: bigint;
    };
  }>({});
  const authenticationRef = useRef<AuthenticationRef>(null);
  const withdrawRequestCells = daoCells.filter(cell => cell.outputData !== "0x0000000000000000");
  const isToValid = values?.to && form.getFieldError('to').length === 0;
  const { withdraw: loadingWithdraw } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );

  const quantumPurse = QuantumPurse.getInstance();

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

    const fetchRedeemingInfo = async () => {
      const daysMap: { [key: string]: {remain: number, profit: number, blockNum: bigint} } = {};
      for (const cell of withdrawRequestCells) {
        const key = cell.outPoint.txHash + cell.outPoint.index;
        try {
          const { depositHeader, withdrawHeader } = await getNervosDaoInfo(cell);
          const remain = await calculateRemainingDays(depositHeader, withdrawHeader, tipHeader);
          const profit = Number(getProfit(cell, depositHeader, withdrawHeader));
          const blockNum = withdrawHeader.number;
          daysMap[key] = { remain, profit, blockNum };
        } catch (error) {
          console.error('Error calculating remaining days for cell:', cell, error);
          daysMap[key] = { remain: Infinity, profit: 0, blockNum: BigInt(0) }; // Error indicators
        }
      }
      setRedeemingInfos(daysMap);
    };

    fetchRedeemingInfo();
  }, [daoCells, tipHeader, quantumPurse.hasClientStarted]);

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

  const calculateRemainingDays = async(
    depositHeader: ClientBlockHeader,
    withdrawHeader: ClientBlockHeader,
    tipHeader: ClientBlockHeader,
  ): Promise<number> => {
    if (!tipHeader) return 0;
    const remainingCycles = Number(
      ccc.fixedPointToString(
        parseEpoch(getClaimEpoch(depositHeader, withdrawHeader)) -
          parseEpoch(tipHeader.epoch)
      )
    ) / 180;
      
    const remainingDays = (remainingCycles ?? 1) * 30;
    return remainingDays;
  };

  // todo update with `withdrawnCell.getNervosDaoInfo` when light client js updates ccc core.
  const getNervosDaoInfo = async (withdrawnCell: ccc.Cell):Promise<
    {
      depositHeader: ClientBlockHeader,
      withdrawHeader: ClientBlockHeader
    }
  > => {
    const withdrawTx = await quantumPurse.client.getTransaction(withdrawnCell.outPoint.txHash);
    const withdrawHeader = await quantumPurse.client.getHeader(withdrawTx?.blockHash as Hex);
    if (!withdrawHeader) {
      throw new Error("Unable to retrieve DAO withdrawing block header!");
    }

    const depositInput = withdrawTx?.transaction.inputs[Number(withdrawnCell.outPoint.index)];
    await quantumPurse.client.fetchTransaction(depositInput?.previousOutput.txHash as Hex);
    const depositTx = await quantumPurse.client.getTransaction(depositInput?.previousOutput.txHash as Hex);
    const depositHeader = await quantumPurse.client.getHeader(depositTx?.blockHash as Hex);
    if (!depositHeader) {
      throw new Error("Unable to retrieve DAO deposit block header!");
    }

    return { depositHeader, withdrawHeader };
  };

  // Catch fee rate changes from FeeRateSelect component
  const handleFeeRateChange = (feeRate: number) => {
    setFeeRate(feeRate);
  };

  const handleWithdraw = async (withdrawnCell: ccc.Cell) => {
    try {
      // todo update when light client js updates ccc core.
      const { depositHeader, withdrawHeader } = await getNervosDaoInfo(withdrawnCell);
      const depositBlockHash = depositHeader.hash;
      const withdrawingBlockHash = withdrawHeader.hash;
      const txId = await dispatch.wallet.withdraw({
        to: values.to,
        withdrawCell: withdrawnCell,
        depositBlockHash: depositBlockHash,
        withdrawingBlockHash: withdrawingBlockHash,
        feeRate
      });
      notification.success({
        message: "Withdraw transaction successful",
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
        message: "Withdraw transaction failed",
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
    <section className={cx(styles.withdrawForm, "panel")}>
      {/* <h1>Withdraw</h1> */}
      <div>
        {(withdrawRequestCells.length > 0 && Object.keys(redeemingInfos).length !== 0) ? (
          <>
            <div>
              <Form layout="vertical" form={form}>
                <Row gutter={16}>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      name="to"
                      label={
                        <div className="label-container">

                          <div className="label-with-icon">
                            Withdraw To
                            <Tooltip title="Be careful! Withdrawing to an address transfers the deposit & reward to that address too.">
                              <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                          </div>

                          <div className="switch-container">
                            My Wallet
                            <Form.Item name="withdrawToMyAccount" noStyle>
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
                              await ccc.Address.fromString(value, quantumPurse.client);
                              return Promise.resolve();
                            } catch (error) {
                              return Promise.reject("Invalid address");
                            }
                          },
                        },
                      ]}
                      className={cx("field-to", values?.withdrawToMyAccount && "select-my-account")}
                    >
                      {!values?.withdrawToMyAccount ? (
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
              </Form>
              <Authentication
                ref={authenticationRef}
                authenCallback={authenCallback}
                title="Withdraw from the DAO"
                afterClose={() => {
                  if (passwordResolver) {
                    passwordResolver.reject();
                    setPasswordResolver(null);
                  }
                }}
              />
            </div>

            <div className={styles.withdrawListContainer}>
              <ul className={styles.withdrawList}>
                {[...withdrawRequestCells]
                  .sort((a,b) => {
                    const keyA = a.outPoint.txHash + a.outPoint.index;
                    const keyB = b.outPoint.txHash + b.outPoint.index;
                    const blockNumA = redeemingInfos[keyA]?.blockNum ?? BigInt(0);
                    const blockNumB = redeemingInfos[keyB]?.blockNum ?? BigInt(0);
                    return Number(blockNumB - blockNumA);
                  })
                  .map((cell) => {
                    const key = cell.outPoint.txHash + cell.outPoint.index;
                    const {remain, profit} = redeemingInfos[key] ?? {remain: Infinity, profit: 0};
                    const progress = Math.max(0, Math.min(1, (30 - remain) / 30));
                    return (
                      <li key={key} className={styles.withdrawItem}>
                        <div
                          className={styles.progressBackground}
                          style={{ width: `${progress * 100}%` }}
                        ></div>
                        <div className={styles.content}>
                          <span className={styles.capacity}>
                            <div>{(Number(BigInt(cell.cellOutput.capacity)) / 10**8).toFixed(2)} CKB</div>
                            <div>+ {(profit/10**8).toFixed(5)} CKB </div>
                            <div>
                              {remain > 0 ? `Withdrawable in ${Number(remain.toFixed(1))} days` : <span style={{ color: 'green' }}>Withdrawable now!</span>}
                            </div>

                          </span>
                          <Button
                            type="primary"
                            loading={loadingWithdraw}
                            onClick={() => handleWithdraw(cell)}
                            disabled={!isToValid || remain > 0}
                          >
                            Withdraw
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
          <div className={styles.withdrawListContainer}>
            <Empty
              description={
                <span style={{ color: 'var(--gray-light)', fontFamily: "Sora, sans-serif" }}>
                  No withdraw requests found! 🫠
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

export default Withdraw;