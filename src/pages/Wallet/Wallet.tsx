import { Button, Flex } from "antd";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch, RootState } from "../../store";
import { cx } from "../../utils/methods";
import Authentication, { AuthenticationRef } from "./Modals/Authentication";
import styles from "./Wallet.module.scss";

const Wallet: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const authenticationRef = useRef<AuthenticationRef>(null);
  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Wallet</h1>

      <Button onClick={() => authenticationRef.current?.open()}>
        Add account
      </Button>
      <div>
        <p>Current account: {wallet.current.address}</p>
      </div>
      <div>
        <ul>
          {wallet.accounts.map(({ address, name, sphincsPlusPubKey }) => (
            <li key={address} style={{ marginTop: "10px" }}>
              <p>{name}</p>
              <p>{sphincsPlusPubKey}</p>
              {wallet.current.sphincsPlusPubKey !== sphincsPlusPubKey && (
                <Button
                  onClick={() =>
                    dispatch.wallet.switchAccount({
                      sphincsPlusPubKey,
                    })
                  }
                >
                  Switch
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Authentication ref={authenticationRef} />
    </section>
  );
};

export default Wallet;
