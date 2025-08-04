import { cx } from "../../utils/methods";
import styles from "./fee_rate.module.scss";
import { useState } from "react";
import { Grid } from "antd";

interface FeeRateSelectProps {
  onFeeRateChange?: (feeRate: number) => void;
}

const FeeRateSelect: React.FC<FeeRateSelectProps> = ({ onFeeRateChange }) => {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const [selectedFee, setSelectedFee] = useState<number>(1500); // Default to medium
  const feeOptions = [
    { name: "Slow 🚀", value: 1000 },
    { name: "Medium 🚀🚀", value: 1500 },
    { name: "Fast 🚀🚀🚀", value: 2000 },
    { name: "Custom", value: 0 },
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
      <div className={styles.feeRateContainer}>
        {feeOptions.map((option) => (
          <div
            key={option.name}
            className={cx(
              styles.feeOption,
              selectedFee === option.value && styles.selected
            )}
            onClick={() => handleFeeSelect(option.value)}
          >
            <div className={styles.feeContent}>
              {!(option.name === "Custom" && selectedFee === 0) && (
                <span className={styles.feeName}>{option.name}</span>
              )}
              {option.name === "Custom" && selectedFee === 0 ? (
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
              ) : (
                screens.md && (
                  <span className={styles.feeValue}>
                    {option.value > 0 ? `${option.value} shannons/kB` : "User specified"}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeeRateSelect;