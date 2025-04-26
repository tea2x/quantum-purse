import { GithubOutlined } from "@ant-design/icons";
import { REPOSITORY_URL } from "../../utils/constants";
import styles from "./footer.module.scss";
import { Grid } from "antd";

const { useBreakpoint } = Grid;

const Footer: React.FC = () => {
  const screens = useBreakpoint();

  return screens.md && (
    <div className={styles.footer}>
      <p>A CKB quantum-safe wallet</p>
      <p>
        Developed by
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          <GithubOutlined />
          tea2x
        </a>
      </p>
    </div>
  );
};

export default Footer;
