import { GithubOutlined } from "@ant-design/icons";
import { GITHUB_URL, X_URL, TELEGRAM_URL } from "../../utils/constants";
import styles from "./footer.module.scss";
import { Grid } from "antd";
import Icon from "../icon/icon";

const { useBreakpoint } = Grid;

const Footer: React.FC = () => {
  const screens = useBreakpoint();

  return (
    <div className={styles.footer}>
      <p>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          <div style={{ fontSize: '18px', display: 'flex', gap: '5px' }}>
            <GithubOutlined />
          </div>
        </a>
      </p>

      <p>
        <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
          <div style={{ fontSize: '12px', display: 'flex', gap: '5px' }}>
            <Icon.Telegram />
          </div>
        </a>
      </p>

      <p>
        <a href={X_URL} target="_blank" rel="noopener noreferrer">
          <div style={{ fontSize: '24px', display: 'flex', gap: '5px' }}>
            <Icon.X />
          </div>
        </a>
      </p>
    </div>
  );
};

export default Footer;
