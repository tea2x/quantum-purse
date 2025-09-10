import { CopyOutlined, GlobalOutlined, DropboxOutlined } from "@ant-design/icons";
import { Flex } from "antd";
import { QRCodeSVG } from "qrcode.react";
import { IAccount } from "../../store/models/interface";
import { shortenAddress } from "../../utils/methods";
import styles from "./account_detail.module.scss";
import { Copy, Explore } from "../../components";
import { message } from "antd";

interface AccountDetailProps {
  account: IAccount;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account }) => {
  const requestFaucet = async () => {
    if (!account?.address) {
      message.error("No active account address found");
      return;
    }

    try {
      const resp = await fetch("https://b45ebf685c04.ngrok-free.app/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.address, amount: 10_000 }),
      });

      const data = await resp.json();

      if (resp.ok) {
        message.success(`Faucet request sent! Tx hash: ${data.txHash}`);
      } else {
        message.error(`Faucet error: ${data.error}`);
      }
    } catch (err: any) {
      message.error(`Request failed: ${err.message}`);
    }
  };

  return (
    <div className={styles.detailContainer}>
      {/* <h2>{account.name}</h2> */}

      <div className={styles.iconContainer}>
        <Explore.Account address={account.address!}>
          <Flex align="center" gap={8} className={styles.extraInfo}>
            <GlobalOutlined />
            Go To CKB Explorer
          </Flex>
        </Explore.Account>

        <div
          onClick={async () => {
            await requestFaucet();
          }}
        >
          <Flex align="center" gap={8} className={styles.extraInfo}>
            <DropboxOutlined />
            Claim CKB
          </Flex>
        </div>
      </div>

      <div className={styles.qrCodeContainer}>
        {account.address && (
          <QRCodeSVG
            value={account.address}
            size={235}
            level="H" // Highest error correction level
          />
        )}
      </div>

      {/* <Copy value={account.address!}>
        <Flex align="center" gap={8} className={styles.extraInfo}>
          <CopyOutlined />
          <span className={styles.address}>
            {shortenAddress(account.address!, 10, 15)}
          </span>
        </Flex>
      </Copy> */}

    </div>
  );
};

export default AccountDetail;
