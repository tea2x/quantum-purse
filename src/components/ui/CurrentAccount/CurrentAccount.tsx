import { Button } from "antd";
import { cx, formatBalance, shortenAddress } from "../../../utils/methods";
import styles from "./CurrentAccount.module.scss";
import { CopyOutlined } from "@ant-design/icons";
interface CurrentAccountProps extends React.HTMLAttributes<HTMLDivElement> {
  address: string;
  name: string;
  balance: string;
}

const CurrentAccount: React.FC<CurrentAccountProps> = ({
  address,
  name,
  balance,
  className,
  ...props
}) => {
  return (
    <div className={cx(styles.currentAccount, className)} {...props}>
      <p className="name">{name}</p>
      <p className="balance">{formatBalance(balance)}</p>
      <div
        className="address-utilities"
        onClick={() => navigator.clipboard.writeText(address)}
      >
        <p className="address">{shortenAddress(address)}</p>
        <CopyOutlined className="copy-icon" />
      </div>
    </div>
  );
};

export default CurrentAccount;
