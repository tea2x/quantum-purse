import { Button, Divider, Dropdown, Flex, Input } from "antd";
import { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CurrentAccount, Explore } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, shortenAddress } from "../../utils/methods";
import Authentication, { AuthenticationRef } from "./Modals/Authentication";
import styles from "./Wallet.module.scss";
import Icon from "../../components/Icon/Icon";
import {
  CaretDownOutlined,
  ExpandOutlined,
  GlobalOutlined,
  MoreOutlined,
  QrcodeOutlined,
  SwapOutlined,
} from "@ant-design/icons";
const Wallet: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const authenticationRef = useRef<AuthenticationRef>(null);
  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Wallet</h1>

      <Flex
        justify="space-between"
        align="center"
        gap={8}
        style={{ marginBottom: 16 }}
      >
        {/* <CurrentAccount
          address={wallet.current.address!}
          name={wallet.current.name}
          balance={wallet.current.balance}
        /> */}
        <Input.Search placeholder="Type something to search your account" />
        <Button
          type="primary"
          onClick={() => authenticationRef.current?.open()}
        >
          Add account
        </Button>
      </Flex>
      <div>
        <ul className="account-list">
          {wallet.accounts.map(
            ({ address, name, sphincsPlusPubKey }, index) => (
              <>
                {index > 0 && <Divider className="divider" />}
                <AccountItem
                  address={address!}
                  name={name}
                  sphincsPlusPubKey={sphincsPlusPubKey}
                />
              </>
            )
          )}
        </ul>
      </div>
      <Authentication ref={authenticationRef} />
    </section>
  );
};

interface AccountItemProps {
  address: string;
  name: string;
  sphincsPlusPubKey: string;
}

const AccountItem: React.FC<AccountItemProps> = ({
  address,
  name,
  sphincsPlusPubKey,
}) => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const menuOptions = useMemo(
    () =>
      [
        {
          key: "switch-account",
          label: (
            <p className="menu-item">
              <SwapOutlined />
              Switch Account
            </p>
          ),
          onClick: () => {
            dispatch.wallet.switchAccount({ sphincsPlusPubKey });
          },
          hidden: sphincsPlusPubKey === wallet.current.sphincsPlusPubKey,
        },
        {
          key: "view-details",
          label: (
            <p  className="menu-item">
              <QrcodeOutlined />
              View Details
            </p>
          ),
        },
        {
          key: "explore",
          label: (
            <Explore.Account address={address} className="menu-item">
              <GlobalOutlined />
              Explore
            </Explore.Account>
          ),
        },
      ].filter((item) => !item.hidden),
    []
  );
  return (
    <li key={address}>
      <div>
        <p className="name">{name}</p>
        <p className="address">{shortenAddress(sphincsPlusPubKey)}</p>
      </div>
      <div>
        <Dropdown
          // openClassName={styles.accountUtils}
          rootClassName={styles.accountUtils}
          menu={{
            items: menuOptions,
          }}
        >
          <Button type="text" className="more-btn">
            <MoreOutlined />
          </Button>
        </Dropdown>
      </div>
    </li>
  );
};

export default Wallet;
