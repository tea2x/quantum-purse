import {
  Button,
  Divider,
  Empty,
  Flex,
  Input,
  notification,
  Spin,
} from "antd";
import React, { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Authentication,
  AuthenticationRef,
  Explore,
} from "../../../components";
import { useAccountSearch } from "../../../hooks/useAccountSearch";
import { Dispatch, RootState } from "../../../store";
import { cx, formatError, shortenAddress } from "../../../utils/methods";
import styles from "./Accounts.module.scss";
import { AccountItem } from "../../../components/account-item/account_item";

const Accounts: React.FC = () => {
  const dispatch = useDispatch<Dispatch>();
  const wallet = useSelector((state: RootState) => state.wallet);
  const {
    createAccount: loadingCreateAccount,
    loadAccounts: loadingLoadAccounts,
    switchAccount: loadingSwitchAccount,
  } = useSelector((state: RootState) => state.loading.effects.wallet);

  const { searchTerm, debouncedSearchTerm, filteredAccounts, handleSearch } =
    useAccountSearch(wallet.accounts);

  const authenticationRef = useRef<AuthenticationRef>(null);

  const createAccountHandler = async (password: string) => {
    try {
      const newAccount = await dispatch.wallet.createAccount({ password });
      notification.success({
        message: `Create ${newAccount.name} successfully`,
        description: (
          <div>
            <Explore.Account address={newAccount.address}>
              {shortenAddress(newAccount.address!, 10, 20)}
            </Explore.Account>
          </div>
        ),
      });
      authenticationRef.current?.close();
    } catch (error) {
      notification.error({
        message: "Failed to create account",
        description: formatError(error),
      });
    }
  };

  const renderAccountList = () => {
    if (filteredAccounts.length === 0 && debouncedSearchTerm) {
      return (
        <Empty
          description={
            <span style={{ color: 'var(--gray-01)' }}>
              No accounts found matching your search
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <ul className="account-container">
        {filteredAccounts.map(({ address, name, spxLockArgs }, index) => (
          <React.Fragment key={spxLockArgs}>
            {index > 0 && (
              <Divider className="divider" key={`divider-${index}`} />
            )}
            <AccountItem
              key={spxLockArgs}
              address={address!}
              name={name}
              spxLockArgs={spxLockArgs}
              isLoading={loadingSwitchAccount}
            />
          </React.Fragment>
        ))}
      </ul>
    );
  };

  return (
    <section className={cx(styles.wallet, "panel")}>
      {/* <h1>Accounts</h1> */}

      <Flex
        justify="space-between"
        align="center"
        gap={8}
        style={{ marginBottom: 16, marginTop: 4 }}
      >
        <Input.Search
          placeholder="Search by name or address"
          onSearch={handleSearch}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          style={{ width: "100%" }}
          value={searchTerm}
        />
        <Button
          type="primary"
          onClick={() => authenticationRef.current?.open()}
          loading={loadingCreateAccount}
          disabled={loadingCreateAccount || loadingLoadAccounts}
        >
          Gen New Account
        </Button>
      </Flex>
      <div className={styles.accountListContainer}>
        <Spin size="large" spinning={loadingLoadAccounts}>
          {renderAccountList()}
        </Spin>
      </div>
      <Authentication
        title="Generating A New Account"
        ref={authenticationRef}
        loading={loadingCreateAccount}
        authenCallback={createAccountHandler}
      />
    </section>
  );
};

export default Accounts;