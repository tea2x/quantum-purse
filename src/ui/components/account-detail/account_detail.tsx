import { GlobalOutlined, DropboxOutlined } from "@ant-design/icons";
import { Flex } from "antd";
import { QRCodeSVG } from "qrcode.react";
import { IAccount } from "../../store/models/interface";
import styles from "./account_detail.module.scss";
import { Explore } from "../../components";
import { message } from "antd";

interface AccountDetailProps {
  account: IAccount;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account }) => {

  const ENDPOINT = 'https://faucet-api.nervos.org/claim_events'

  const claimCKB = async () => {
    if (!account?.address) {
      message.error("No active account address found");
      return;
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          claim_event: {
            address_hash: account.address, // recipient
            amount: '10000'  // 100,00 CKB
          }
        })
      });

      // if (!res.ok) {
      //   throw new Error(`Server returned ${res.status}`);
      // } else {
      //   message.success(`Faucet request successful`);
      // }

      // const data = await res.json();
      // return data;
    } catch (err: any) {
      message.error(`Request failed: ${err.message}`);
    }
  }

  return (
    <div className={styles.detailContainer}>
      <div className={styles.qrCodeContainer}>
        <div className={styles.iconContainer}>
          <Explore.Account address={account.address!}>
            <Flex align="center" gap={8} className={styles.extraInfo}>
              <GlobalOutlined />
              CKB Explorer
            </Flex>
          </Explore.Account>

          <div
            onClick={async () => {
              await claimCKB();
            }}
          >
            <Flex align="center" gap={8} className={styles.extraInfo}>
              <DropboxOutlined />
              Claim CKB
            </Flex>
          </div>
        </div>
        {account.address && (
          <QRCodeSVG
            value={account.address}
            size={235}
            level="H" // Highest error correction level
          />
        )}
      </div>
    </div>
  );
};

export default AccountDetail;
