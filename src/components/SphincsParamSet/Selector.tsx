import { Form, Select, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { SphincsVariant } from "../../core/quantum_purse";

const ParamSet: React.FC = () => {
  return (
    <Form.Item
      label={
        <span>
          Parameter set
          <Tooltip
            title="The 's' variant (e.g., sha2-256s) produces smaller signatures and fast vericication (CKB friendly) but require longer signing time.
                    The 'f' variant (e.g., sha2-256f) delivers faster signing at the expense of larger signatures and longer verification.
                    For CKB, we recommend:
                    Sha2-128s/sha2-192s when security is a lower priority and Sha2-256s when higher security is needed."
          >
            <QuestionCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
      name="parameterSet"
      rules={[{ required: true, message: "Please select a parameter set" }]}
    >
      <Select size="large" placeholder="Select a SPHINCS+ variant">
        <Select.OptGroup label="128-bit Security">
          <Select.Option value={SphincsVariant.Sha2128S}>sha2_128s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2128F}>sha2_128f</Select.Option>
          <Select.Option value={SphincsVariant.Shake128S}>shake_128s</Select.Option>
          <Select.Option value={SphincsVariant.Shake128F}>shake_128f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="192-bit Security">
          <Select.Option value={SphincsVariant.Sha2192S}>sha2_192s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2192F}>sha2_192f</Select.Option>
          <Select.Option value={SphincsVariant.Shake192S}>shake_192s</Select.Option>
          <Select.Option value={SphincsVariant.Shake192F}>shake_192f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="256-bit Security">
          <Select.Option value={SphincsVariant.Sha2256S}>sha2_256s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2256F}>sha2_256f</Select.Option>
          <Select.Option value={SphincsVariant.Shake256S}>shake_256s</Select.Option>
          <Select.Option value={SphincsVariant.Shake256F}>shake_256f</Select.Option>
        </Select.OptGroup>
      </Select>
    </Form.Item>
  );
};

export default ParamSet;