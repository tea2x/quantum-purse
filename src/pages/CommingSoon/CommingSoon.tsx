import { cx } from "../../utils/methods";
import styles from "./CommingSoon.module.scss";

const CommingSoon: React.FC = () => {
  return (
    <section className={cx(styles.commingSoon, "panel")}>CommingSoon</section>
  );
};

export default CommingSoon;
