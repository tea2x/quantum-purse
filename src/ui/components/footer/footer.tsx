import { GithubOutlined } from "@ant-design/icons";
import { REPOSITORY_URL } from "../../utils/constants";
import styles from "./footer.module.scss";
const Footer: React.FC = () => {
  return (
    <div className={styles.footer}>
      <p>A non-custodial quantum-safe wallet for CKB</p>
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
