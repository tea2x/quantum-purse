import { Navigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import { cx } from "../../utils/methods";
import styles from "./ImportWallet.module.scss";

const ImportWallet: React.FC = () => {
  return <Navigate to={ROUTES.COMING_SOON} />;
  return (
    <section className={cx(styles.importWallet, "panel")}>ImportWallet</section>
  );
};

export default ImportWallet;
