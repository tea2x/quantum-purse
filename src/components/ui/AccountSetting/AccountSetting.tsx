import { useState } from "react";
import { CopyOutlined } from "@ant-design/icons";
import { Copy } from "../..";
import { IAccount } from "../../../store/models/interface";
import { shortenAddress } from "../../../utils/methods";
import styles from "./AccountSetting.module.scss";
import { Button, Flex, Input, Divider } from "antd";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import QuantumPurse from "../../../core/quantum_purse";
import { LightClientSetScriptsCommand } from "ckb-light-client-js";

interface AccountSettingProps {
  account: IAccount;
}

const AccountSetting: React.FC<AccountSettingProps> = ({ account }) => {
  const syncStatus = useSelector((state: RootState) => state.wallet.syncStatus);
  const [startingBlock, setStartingBlock] = useState("");
  const isValidStartingBlock = /^\d+$/.test(startingBlock);

  return (
    <div className={styles.settingContainer}>
      <h2>{account.name}</h2>

      <Copy value={account.address!}>
        <Flex align="center" gap={8} className={styles.address}>
          {shortenAddress(account.address!, 10, 20)}
          <CopyOutlined />
        </Flex>
      </Copy>
      <Divider style={{ margin: '4px 0'}}>{"Current start block: " + syncStatus.startBlock.toString()}</Divider>
      <div className={styles.startingBlock}>
        <Flex align="center" gap={8}>
          <Input
            value={startingBlock}
            onChange={(e) => setStartingBlock(e.target.value)}
            placeholder={"Must be in range [0," + syncStatus.tipBlock.toString() + "]"}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            onClick={async () => {
              const wallet = await QuantumPurse.getInstance();
              await wallet.setSellectiveSyncFilter(
                [account.sphincsPlusPubKey],
                [BigInt(startingBlock)],
                LightClientSetScriptsCommand.Partial
              );
              setStartingBlock("");
            }}
            disabled={!isValidStartingBlock}
          >
            Set start block
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default AccountSetting;