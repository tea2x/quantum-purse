import { cx } from "../../utils/methods";
import styles from "./fee_rate.module.scss";
import { useState } from "react";
import { Tooltip } from "antd";

interface FeeRateSelectProps {
  onFeeRateChange: (feeRate: number) => void;
  custom: boolean;
}

const FeeRateSelect: React.FC<FeeRateSelectProps> = ({ onFeeRateChange, custom }) => {
  const [selectedFee, setSelectedFee] = useState<number>(1500); // Default to medium
  const feeOptions = [
    { name: "Slow", value: 1000 },
    { name: "Medium", value: 1500 },
    { name: "Fast", value: 2000 },
  ];

  const handleFeeSelect = (value: number) => {
    setSelectedFee(value);
    if (onFeeRateChange) {
      onFeeRateChange(value);
    }
  };

  const handleCustomFeeChange = (value: number) => {
    if (onFeeRateChange) {
      onFeeRateChange(value);
    }
  };

  return (
    <div className={styles.feeRate}>
      {custom ? (
        <div>
          <input
            type="number"
            placeholder="Enter fee rate"
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              handleCustomFeeChange(value);
            }}
            className={styles.customInputField}
            autoFocus
          />
        </div>
      ) : (
        <div className={styles.feeRateContainer}>
          {feeOptions.map((option) => (
            <Tooltip title={`${option.value} shannons/kB`}>
              <div
                key={option.name}
                className={cx(
                  styles.feeOption,
                  selectedFee === option.value && styles.selected
                )}
                onClick={() => handleFeeSelect(option.value)}
              >
                <div className={styles.feeContent}>
                  <span className={styles.feeName}>
                    {option.name}
                  </span>
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeeRateSelect;