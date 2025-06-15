import { Form, Select, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { SpxVariant } from "../../../core/quantum_purse";

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
      rules={[{ required: true, message: "Required!" }]}
    >
      <Select
        size="large"
        placeholder="Select a SPHINCS+ variant"
      >
        <Select.OptGroup label="256-bit">
          <Select.Option value={SpxVariant.Sha2256S}>SHA2_256s</Select.Option>
          <Select.Option value={SpxVariant.Sha2256F}>SHA2_256f</Select.Option>
          <Select.Option value={SpxVariant.Shake256S}>SHAKE_256s</Select.Option>
          <Select.Option value={SpxVariant.Shake256F}>SHAKE_256f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="192-bit">
          <Select.Option value={SpxVariant.Sha2192S}>SHA2_192s</Select.Option>
          <Select.Option value={SpxVariant.Sha2192F}>SHA2_192f</Select.Option>
          <Select.Option value={SpxVariant.Shake192S}>SHAKE_192s</Select.Option>
          <Select.Option value={SpxVariant.Shake192F}>SHAKE_192f</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="128-bit">
          <Select.Option value={SpxVariant.Sha2128S}>SHA2_128s</Select.Option>
          <Select.Option value={SpxVariant.Sha2128F}>SHA2_128f</Select.Option>
          <Select.Option value={SpxVariant.Shake128S}>SHAKE_128s</Select.Option>
          <Select.Option value={SpxVariant.Shake128F}>SHAKE_128f</Select.Option>
        </Select.OptGroup>
      </Select>
    </Form.Item>
  );
};

export default ParamsetSelector;