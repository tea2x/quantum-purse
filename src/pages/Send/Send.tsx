import { Button, Flex, Form, Input, InputNumber, Select, Switch } from "antd";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch, RootState } from "../../store";
import { CKB_UNIT } from "../../utils/constants";
import { cx } from "../../utils/methods";
import { AccountItem } from "../Wallet/Wallet";
import { Authentication, AuthenticationRef } from "../../components";
import styles from "./Send.module.scss";

const Send: React.FC = () => {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const dispatch = useDispatch<Dispatch>();
  const authenticationRef = useRef<AuthenticationRef>(null);
  const wallet = useSelector((state: RootState) => state.wallet);
  const options = wallet.accounts.map(
    ({ sphincsPlusPubKey, name, address }) => ({
      value: address,
      key: sphincsPlusPubKey,
      label: (
        <div className="contact-item">
          <AccountItem
            address={address!}
            name={name}
            sphincsPlusPubKey={sphincsPlusPubKey}
            hasTools={false}
            copyable={false}
          />
        </div>
      ),
    })
  );

  const onFinish = ({ from, to, amount, password }: any) => {
    dispatch.wallet.send({ from, to, amount, password });
  };

  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Send</h1>
      <div>
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            from: wallet.current.address,
            isSendToMyAccount: true,
            to: wallet.current.address,
            amount: 120,
          }}
          className={styles.sendForm}
        >
          <Form.Item
            name="from"
            label="From"
            rules={[{ required: true, message: "Please input an account" }]}
            className={"field-from select-my-account"}
          >
            <Select
              showSearch
              filterOption={false}
              options={options}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="to"
            label={
              <div className="label-container">
                To
                <div className="switch-container">
                  Send To My Account
                  <Form.Item
                    name="isSendToMyAccount"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch />
                  </Form.Item>
                </div>
              </div>
            }
            rules={[
              { required: true, message: "Please enter a destination address" },
            ]}
            className={cx(
              "field-to",
              values?.isSendToMyAccount && "select-my-account"
            )}
          >
            {!values?.isSendToMyAccount ? (
              <Input placeholder="Input the destination address" />
            ) : (
              <Select
                placeholder="Please select account from your wallet"
                showSearch
                filterOption={false}
                options={options}
                allowClear
              />
            )}
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: "Please input amount" },
              {
                type: "number",
                min: 73,
                message: "Amount must be at least 73 CKB",
              },
            ]}
          >
            <InputNumber min={73} step={1} addonAfter={CKB_UNIT} controls />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              onClick={() => authenticationRef.current?.open()}
            >
              Send
            </Button>
          </Form.Item>
        </Form>
        <Authentication
          ref={authenticationRef}
          authenCallback={(password) => {
            onFinish({ ...values, password });
          }}
        />
      </div>
    </section>
  );
};

export default Send;
