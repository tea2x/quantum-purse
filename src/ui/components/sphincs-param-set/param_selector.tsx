import { Form, Select, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { SphincsVariant } from "../../../core/quantum_purse";

const ParamsetSelector: React.FC = () => {
  return (
    <Form.Item
      label={
        <span style={{ color: 'var(--gray-01)' }}>
          Parameter set
          <Tooltip
            title="There are 12 SPHINCS+ parameter sets in total. Sha2_256s is recommended if you have no reference!"
          >
            <QuestionCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
      name="parameterSet"
      rules={[{ required: true, message: "Please select a parameter set" }]}
    >
      <Select
        size="large"
        placeholder="Select a SPHINCS+ variant"
      >
        <Select.OptGroup label="256-bit Security">
          <Select.Option value={SphincsVariant.Sha2256S}>Sha2_256s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2256F}>Sha2_256f</Select.Option>
          <Select.Option value={SphincsVariant.Shake256S}>Shake_256s</Select.Option>
          <Select.Option value={SphincsVariant.Shake256F}>Shake_256f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="192-bit Security">
          <Select.Option value={SphincsVariant.Sha2192S}>Sha2_192s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2192F}>Sha2_192f</Select.Option>
          <Select.Option value={SphincsVariant.Shake192S}>Shake_192s</Select.Option>
          <Select.Option value={SphincsVariant.Shake192F}>Shake_192f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="128-bit Security">
          <Select.Option value={SphincsVariant.Sha2128S}>Sha2_128s</Select.Option>
          <Select.Option value={SphincsVariant.Sha2128F}>Sha2_128f</Select.Option>
          <Select.Option value={SphincsVariant.Shake128S}>Shake_128s</Select.Option>
          <Select.Option value={SphincsVariant.Shake128F}>Shake_128f</Select.Option>
        </Select.OptGroup>
      </Select>
    </Form.Item>
  );
};

export default ParamsetSelector;