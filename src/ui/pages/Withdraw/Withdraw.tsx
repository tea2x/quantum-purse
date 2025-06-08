import { Button, notification } from "antd";
import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Explore, Authentication, AuthenticationRef } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, formatError } from "../../utils/methods";
import styles from "./Withdraw.module.scss";
import QuantumPurse from "../../../core/quantum_purse";
import { ccc, ClientBlockHeader, Hex } from "@ckb-ccc/core";
import { NERVOS_DAO } from "../../../core/config";

const Withdraw: React.FC = () => {
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

  const handleWithdraw = async (depositCell: ccc.Cell) => {
    try {
      // todo update when light client js updates ccc core.
      const { depositHeader } = await getNervosDaoInfo(depositCell);
      const depositBlockNum = depositHeader.number;
      const depositBlockHash = depositHeader.hash;
      const txId = await dispatch.wallet.withdraw({ depositCell, depositBlockNum, depositBlockHash });
      notification.success({
        message: "Withdraw transaction successful",
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

  const depositCells = daoCells.filter(cell => cell.outputData === "0x0000000000000000");

  return (
    <section className={cx(styles.withdrawForm, "panel")}>
      <h1>Withdraw</h1>
      <div>
        {depositCells.length > 0 ? (
          <div className={styles.depositListContainer}>
            <ul className={styles.depositList}>
              {depositCells.map((cell, index) => (
                <li key={index}>
                  <span>{(Number(BigInt(cell.cellOutput.capacity)) / 10**8).toFixed(2)} CKB</span>
                  <Button onClick={() => handleWithdraw(cell)}>Withdraw</Button>
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
        title="Withdrawing from Nervos DAO"
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

export default Withdraw;