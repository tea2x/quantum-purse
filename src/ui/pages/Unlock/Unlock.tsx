import { Button, notification, Form, Switch, Input, Flex } from "antd";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AccountSelect, Explore, Authentication, AuthenticationRef } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, formatError } from "../../utils/methods";
import styles from "./Unlock.module.scss";
import QuantumPurse from "../../../core/quantum_purse";
import { ccc, ClientBlockHeader, Hex } from "@ckb-ccc/core";
import { NERVOS_DAO } from "../../../core/config";
import { addressToScript } from "@nervosnetwork/ckb-sdk-utils";

const Unlock: React.FC = () => {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const [submittable, setSubmittable] = useState(false);
  const { unlock: loadingUnlock } = useSelector(
    (state: RootState) => state.loading.effects.wallet
  );
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const [daoCells, setDaoCells] = useState<ccc.Cell[]>([]);
  const [passwordResolver, setPasswordResolver] = useState<{
    resolve: (password: string) => void;
    reject: () => void;
  } | null>(null);
  const authenticationRef = useRef<AuthenticationRef>(null);

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
        setDaoCells(daos);
      }
    })();
  }, [quantumPurse, quantumPurse.accountPointer]);

  useEffect(() => {
    if (quantumPurse) {
      quantumPurse.requestPassword = (resolve, reject) => {
        setPasswordResolver({ resolve, reject });
        authenticationRef.current?.open();
      };
      return () => {
        quantumPurse.requestPassword = undefined;
      };
    }
  }, [quantumPurse]);

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
    const depositTx = await quantumPurse.client.getTransaction(depositInput?.previousOutput.txHash as Hex);
    const depositHeader = await quantumPurse.client.getHeader(depositTx?.blockHash as Hex);
    if (!depositHeader) {
      throw new Error("Unable to retrieve DAO withdrawing block header!");
    }

    return {depositHeader, withdrawHeader};
  };

  const handleUnlock = async (withdrawnCell: ccc.Cell) => {
    try {
      // todo update when light client js updates ccc core.
      const { depositHeader, withdrawHeader } = await getNervosDaoInfo(withdrawnCell);
      const depositBlockHash = depositHeader.hash;
      const withdrawingBlockHash = withdrawHeader.hash;
      const txId = await dispatch.wallet.unlock(
        { 
          withdrawCell: withdrawnCell,
          to: values.to,
          depositBlockHash: depositBlockHash,
          withdrawingBlockHash: withdrawingBlockHash
        }
      );
      notification.success({
        message: "Unlock transaction successful",
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
        message: "Unlock transaction failed",
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

  const withdrawnCells = daoCells.filter(cell => cell.outputData !== "0x0000000000000000");

  return (
    <section className={cx(styles.unlockForm, "panel")}>
      <h1>Unlock</h1>
      <div>
        <Form layout="vertical" form={form}>
          <Form.Item
            name="to"
            label={
              <div className="label-container">
                To
                <div className="switch-container">
                  My Account
                  <Form.Item name="isUnlockToMyAccount" style={{ marginBottom: 0 }}>
                    <Switch />
                  </Form.Item>
                </div>
              </div>
            }
            rules={[
              { required: true, message: "Please enter a destination address" },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    addressToScript(value);
                    return Promise.resolve();
                  } catch (error) {
                    return Promise.reject("Please input a valid address");
                  }
                },
              },
            ]}
            className={cx("field-to", values?.isUnlockToMyAccount && "select-my-account")}
          >
            {!values?.isUnlockToMyAccount ? (
              <Input placeholder="Input the destination address" />
            ) : (
              <AccountSelect
                accounts={wallet.accounts}
                placeholder="Please select account from your wallet"
              />
            )}
          </Form.Item>
        </Form>
        <Authentication
          ref={authenticationRef}
          authenCallback={authenCallback}
          title="Unlocking from Nervos DAO"
          afterClose={() => {
            if (passwordResolver) {
              passwordResolver.reject();
              setPasswordResolver(null);
            }
          }}
        />
      </div>
      <div>
        {withdrawnCells.length > 0 ? (
          <div className={styles.unlockListContainer}>
            <ul className={styles.unlockList}>
              {withdrawnCells.map((cell, index) => (
                <li key={index}>
                  <span>{(Number(BigInt(cell.cellOutput.capacity)) / 10**8).toFixed(2)} CKB</span>
                  <Button onClick={() => handleUnlock(cell)}>Unlock</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-01)', textAlign: 'center', fontSize: '1.5rem' }}>
            No deposits found.
          </p>
        )}
      </div>
      <Authentication
        ref={authenticationRef}
        authenCallback={authenCallback}
        title="Unlocking withdrawn deposit from Nervos DAO"
        afterClose={() => {
          if (passwordResolver) {
            passwordResolver.reject();
            setPasswordResolver(null);
          }
        }}
      />
    </section>
  );
};

export default Unlock;