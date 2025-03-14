import { Button, Form, InputNumber, Select } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch, RootState } from "../../store";
import { CKB_UNIT } from "../../utils/constants";
import { cx, shortenAddress } from "../../utils/methods";
import styles from "./Send.module.scss";
import Authentication, { AuthenticationRef } from "./Modals/Authentication";
import { useRef } from "react";

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
          <p className="name">{name}</p>
          <p className="address">{shortenAddress(sphincsPlusPubKey)}</p>
        </div>
      ),
    })
  );

  const onFinish = ({ from, to, amount, password }: any) => {
    dispatch.wallet.send({ from, to, amount, password });
  };

  console.log(values);

  return (
    <section className={cx(styles.wallet, "panel")}>
      <h1>Send</h1>
      <div>
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            from: "ckt1qpfwarn3894t62vh7lczd97afscvxnt4rwn4g8d3s9uj9dad6jj2qqnujcz925q2zzwe5slw4sz9lk3em9y8lxey3wvxulk8tdjqnth4js3f0hcs",
            to: "ckt1qpfwarn3894t62vh7lczd97afscvxnt4rwn4g8d3s9uj9dad6jj2qqkkwsdpr52hheahahqfrvuxf5l2tpws3zgl9shdv4wugs8u35mt0vgyae27",
          }}
        >
          <Form.Item
            name="from"
            label="From"
            rules={[{ required: true, message: "Please input an account" }]}
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
            label="To"
            rules={[{ required: true, message: "Please input an account" }]}
          >
            <Select
              placeholder="Select my account"
              showSearch
              filterOption={false}
              options={options}
              allowClear
            />
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
