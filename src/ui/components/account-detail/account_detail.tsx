import { CopyOutlined, GlobalOutlined } from "@ant-design/icons";
import { Flex } from "antd";
import { QRCodeSVG } from "qrcode.react";
import { IAccount } from "../../store/models/interface";
import { shortenAddress } from "../../utils/methods";
import styles from "./account_detail.module.scss";
import { Copy, Explore } from "../../components";

interface AccountDetailProps {
  account: IAccount;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account }) => {
  return (
    <div className={styles.detailContainer}>
      {/* <h2>{account.name}</h2> */}

      <div className={styles.iconContainer}>
        <Explore.Account address={account.address!}>
          <Flex align="center" gap={8} className={styles.extraInfo}>
            <GlobalOutlined />
            Go to Explorer
          </Flex>
        </Explore.Account>

        <Copy value={account.address!}>
          <Flex align="center" gap={8} className={styles.extraInfo}>
            <CopyOutlined />
            {shortenAddress(account.address!, 4, 4)}
          </Flex>
        </Copy>
      </div>
      
      <div className={styles.qrCodeContainer}>
        {account.address && (
          <QRCodeSVG
            value={account.address}
            size={225}
            level="H" // Highest error correction level
          />
        )}
      </div>
    </div>
  );
};

export default AccountDetail;
