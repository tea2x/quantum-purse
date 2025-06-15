import QuantumPurse, { SpxVariant } from "../../core/quantum_purse";
import { utf8ToBytes } from "../../core/utils";

const usePasswordValidator = (variant: SpxVariant) => {
  const entropyValidator = (password: string) => {
    if (!password) {
      return Promise.resolve();
    }

    const entropyMap = {
      [SpxVariant.Sha2128F]: 128,
      [SpxVariant.Shake128F]: 128,
      [SpxVariant.Sha2128S]: 128,
      [SpxVariant.Shake128S]: 128,
      [SpxVariant.Sha2192F]: 192,
      [SpxVariant.Shake192F]: 192,
      [SpxVariant.Sha2192S]: 192,
      [SpxVariant.Shake192S]: 192,
      [SpxVariant.Sha2256F]: 256,
      [SpxVariant.Shake256F]: 256,
      [SpxVariant.Sha2256S]: 256,
      [SpxVariant.Shake256S]: 256,
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
    { required: true, message: "" },
    {
      validator: (_: any, value: string) => {
        return entropyValidator(value);
      },
    },
  ];
  return { rules };
};

export default usePasswordValidator;
