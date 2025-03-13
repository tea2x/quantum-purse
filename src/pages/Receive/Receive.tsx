import { CopyOutlined } from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";
import { QRCodeSVG } from "qrcode.react";
import { useDispatch, useSelector } from "react-redux";
import { Copy } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, shortenAddress } from "../../utils/methods";
import styles from "./Receive.module.scss";

const { Title, Text, Paragraph } = Typography;

const Receive: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const activeAccount = useSelector((state: RootState) => state.wallet.current);

  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Receive</h1>

      <div className={styles.receiveContainer}>
        <h2>{activeAccount.name}</h2>

        <Copy value={activeAccount.address!}>
          <Flex align="center" gap={8} className={styles.address}>
            {shortenAddress(activeAccount.address!, 10, 10)}
            <CopyOutlined />
          </Flex>
        </Copy>

        <div className={styles.qrCodeContainer}>
          {activeAccount.address && (
            <QRCodeSVG
              value={activeAccount.address}
              size={200}
              level="H" // Highest error correction level
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default Receive;
