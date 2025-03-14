import {
  CopyOutlined,
  GlobalOutlined,
  MoreOutlined,
  QrcodeOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button, Divider, Dropdown, Flex, Input } from "antd";
import { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Copy, Explore } from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, shortenAddress } from "../../utils/methods";
import Authentication, { AuthenticationRef } from "./Modals/Authentication";
import styles from "./Wallet.module.scss";
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
                {index > 0 && <Divider className="divider" key={index} />}
                <AccountItem
                  key={sphincsPlusPubKey}
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

interface AccountItemProps extends React.HTMLAttributes<HTMLLIElement> {
  address: string;
  name: string;
  sphincsPlusPubKey: string;
}

export const AccountItem: React.FC<AccountItemProps> = ({
  address,
  name,
  sphincsPlusPubKey,
  ...props
}) => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const isActive = sphincsPlusPubKey === wallet.current.sphincsPlusPubKey;
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
          hidden: isActive,
        },
        {
          key: "view-details",
          label: (
            <p className="menu-item">
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
    [isActive, sphincsPlusPubKey, address]
  );
  return (
    <li
      {...props}
      className={cx(styles.accountItem, isActive && styles.active)}
    >
      <div className="account-info">
        <p className="name">{name}</p>
        <Copy value={address}>
          <p className="address">
            <span>{shortenAddress(address, 10, 20)}</span>
            <CopyOutlined />
          </p>
        </Copy>
      </div>
      <div>
        <Dropdown
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
