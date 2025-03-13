import { CopyOutlined } from "@ant-design/icons";
import { message } from "antd";
import { cx, formatBalance, shortenAddress } from "../../../utils/methods";
import styles from "./CurrentAccount.module.scss";
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
  const [messageApi, messageContextHolder] = message.useMessage();
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    messageApi.success("Address copied to clipboard", 3);
  };
  return (
    <div className={cx(styles.currentAccount, className)} {...props}>
      {messageContextHolder}
      <p className="name">{name}</p>
      <p className="balance">{formatBalance(balance)}</p>
      <div className="address-utilities" onClick={copyAddress}>
        <p className="address">{shortenAddress(address)}</p>
        <CopyOutlined className="copy-icon" />
      </div>
    </div>
  );
};

export default CurrentAccount;
