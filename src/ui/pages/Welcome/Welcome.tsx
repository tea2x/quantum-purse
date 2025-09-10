import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import styles from "./Welcome.module.scss";

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.welcome}>
      <h1>Welcome to Quantum Purse</h1>
      <p>Lightweight Client Wallet, Post-Quantum Hardened, Powered by CKB.</p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Input
          style={{marginBottom: "1.5rem", height: "3.5rem", width: "30rem"}}
          placeholder="Enter Your Email For future updates!"
        >
        </Input>

        <p
          style={{
            marginBottom: "0",
            color: "var(--gray-light)",
            fontSize: "14px"
          }}
        >
          Or
        </p>

        <Button
          onClick={() => navigate(ROUTES.CREATE_WALLET, {replace: true})}
          style={{margin: "1.5rem auto", height: "3.5rem", width: "30rem"}}
        >
          Create a New Wallet
        </Button>
      </div>
    </section>
  );
};

export default Welcome;
