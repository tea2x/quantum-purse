import { useState } from "react";
import { CopyOutlined } from "@ant-design/icons";
import Copy from "../copy/copy";
import { IAccount } from "../../store/models/interface";
import { shortenAddress } from "../../utils/methods";
import styles from "./account_setting.module.scss";
import { Button, Flex, Form, Input, notification } from "antd";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import QuantumPurse from "../../../core/quantum_purse";
import { LightClientSetScriptsCommand } from "@nervosnetwork/ckb-light-client-js";
import { Hex } from "@ckb-ccc/core";
import { formatError } from "../../utils/methods";

interface AccountSettingProps {
  account: IAccount;
  onClose?: () => void;
}

const AccountSetting: React.FC<AccountSettingProps> = ({ account, onClose }) => {
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);
  const [startingBlock, setStartingBlock] = useState("");
  const [isSettingBlock, setIsSettingBlock] = useState(false);
  const tipBlock = syncStatus.tipBlock;

  const startBlockValidator = (): string | undefined => {
    if (startingBlock === "") return undefined;
    if (!/^\d+$/.test(startingBlock)) return "Please enter a valid number";
    if (Number(startingBlock) > tipBlock) return `Valid range is [0, ${tipBlock}]`;
    return undefined;
  };

  const validationResult = startBlockValidator();
  const isValidStartingBlock = (startingBlock !== "") && !validationResult;

  const handleSetStartingBlock = async () => {
    setIsSettingBlock(true);
    try {
      await QuantumPurse.getInstance().setSellectiveSyncFilter(
        [account.spxLockArgs as Hex],
        [BigInt(startingBlock)],
        LightClientSetScriptsCommand.Partial
      );
      setStartingBlock("");
      if (onClose) {
        onClose();
      }
      notification.success({
        message: "Starting block set successfully",
      });
    } catch (error) {
      notification.error({
        message: "Failed to set starting block",
        description: formatError(error),
      });
    } finally {
      setIsSettingBlock(false);
    }
  };

  return (
    <div className={styles.accountDetails}>
      <h2 className={styles.centeredHeading}>{account.name}</h2>
      <Copy value={account.address!}>
        <Flex align="center" gap={8} className={styles.address}>
          {shortenAddress(account.address!, 10, 20)}
          <CopyOutlined />
        </Flex>
      </Copy>
      <div className={styles.startingBlock}>
        <Form.Item
          validateStatus={validationResult ? "error" : undefined}
          help={validationResult}
          style={{ marginBottom: 0 }}
        >
          <Flex align="center" gap={8}>
            <Input
              value={startingBlock}
              onChange={(e) => setStartingBlock(e.target.value)}
              placeholder={`Valid range: [0, ${syncStatus.tipBlock}]`}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              onClick={handleSetStartingBlock}
              disabled={!isValidStartingBlock || isSettingBlock}
              loading={isSettingBlock}
            >
              Set Start Block
            </Button>
          </Flex>
        </Form.Item>
      </div>
    </div>
  );
};

export default AccountSetting;