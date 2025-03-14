import {
  CopyOutlined,
  GlobalOutlined,
  MoreOutlined,
  QrcodeOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button, Divider, Dropdown, Flex, Input, Modal, Tag } from "antd";
import { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Authentication,
  AuthenticationRef,
  Copy,
  Explore,
} from "../../components";
import { Dispatch, RootState } from "../../store";
import { cx, shortenAddress } from "../../utils/methods";
import styles from "./Wallet.module.scss";
const Wallet: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const authenticationRef = useRef<AuthenticationRef>(null);

  const createAccountHandler = async (password: string) => {
    await dispatch.wallet.createAccount({ password });
    Modal.success({
      title: "Create account successfully",
      content: (
        <div>
          <p>{wallet.current.name} has been created successfully</p>
          <p>{shortenAddress(wallet.current.address!)}</p>
        </div>
      ),
      centered: true,
      className: "global-modal",
    });
  };

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
      <Authentication
        ref={authenticationRef}
        authenCallback={createAccountHandler}
      />
    </section>
  );
};

interface AccountItemProps extends React.HTMLAttributes<HTMLLIElement> {
  address: string;
  name: string;
  sphincsPlusPubKey: string;
  hasTools?: boolean;
  copyable?: boolean;
}

export const AccountItem: React.FC<AccountItemProps> = ({
  address,
  name,
  sphincsPlusPubKey,
  hasTools = true,
  copyable = true,
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
    <li {...props} className={cx(styles.accountItem)}>
      <div className="account-info">
        <p className="name">
          {name}{" "}
          {isActive && (
            <Tag color="var(--teal-2)" className="current">
              Current
            </Tag>
          )}
        </p>
        {copyable ? (
          <Copy value={address} className="address copyable">
            <span>{shortenAddress(address, 10, 20)}</span>
            <CopyOutlined />
          </Copy>
        ) : (
          <div className="address">{shortenAddress(address, 10, 20)}</div>
        )}
      </div>
      <div>
        {hasTools && (
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
        )}
      </div>
    </li>
  );
};

export default Wallet;
