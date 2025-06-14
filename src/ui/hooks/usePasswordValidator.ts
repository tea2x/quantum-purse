import QuantumPurse, { SphincsVariant } from "../../core/quantum_purse";
import { utf8ToBytes } from "../../core/utils";

const usePasswordValidator = (variant: SphincsVariant) => {
  const entropyValidator = (password: string) => {
    if (!password) {
      return Promise.resolve();
    }

    const entropyMap = {
      [SphincsVariant.Sha2128F]: 128,
      [SphincsVariant.Shake128F]: 128,
      [SphincsVariant.Sha2128S]: 128,
      [SphincsVariant.Shake128S]: 128,
      [SphincsVariant.Sha2192F]: 192,
      [SphincsVariant.Shake192F]: 192,
      [SphincsVariant.Sha2192S]: 192,
      [SphincsVariant.Shake192S]: 192,
      [SphincsVariant.Sha2256F]: 256,
      [SphincsVariant.Shake256F]: 256,
      [SphincsVariant.Sha2256S]: 256,
      [SphincsVariant.Shake256S]: 256,
    };
    const entropyLevel = entropyMap[variant] || 256;

    try {
      QuantumPurse.checkPassword(utf8ToBytes(password), entropyLevel);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(error as string));
    }
  };

  const rules = [
    { required: true, message: "Required!" },
    {
      validator: (_: any, value: string) => {
        return entropyValidator(value);
      },
    },
  ];
  return { rules };
};

export default usePasswordValidator;
