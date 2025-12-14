import QuantumPurse, { SpxVariant } from "../../core/quantum_purse";
import { utf8ToBytes } from "../../core/utils";

const usePasswordValidator = (variant: SpxVariant) => {
  const formatValidator = (password: string) => {
    if (!password) {
      return Promise.resolve();
    }

    let passwordBytes: Uint8Array = new Uint8Array(0);
    try {
      passwordBytes = utf8ToBytes(password);
      QuantumPurse.checkPassword(passwordBytes);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(new Error(error as string));
    } finally {
      passwordBytes.fill(0);
    }
  };

  const entropyLevelValidator = async (_: any, password: string) => {
    if (!password) {
      return Promise.resolve();
    }
    let passwordBytes: Uint8Array = new Uint8Array(0);
    try {
      passwordBytes = utf8ToBytes(password);
      const level = QuantumPurse.checkPassword(passwordBytes);
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
      const requiredEntropy = entropyMap[variant] || 256;
      if (level < requiredEntropy) {
        return Promise.reject(new Error("abc"));
      }
      return Promise.resolve();
    } catch (error) {
      // Ignore errors here
      return Promise.resolve();
    } finally {
      passwordBytes.fill(0);
    }
  };

  const rules = [
    { required: true, message: "" },
    {
      validator: (_: any, value: string) => {
        return formatValidator(value);
      },
    },
    {
      validator: entropyLevelValidator,
      message: "Looks a little weak — consider adding more characters to enhance security.",
      warningOnly: true,
    },
  ];
  return { rules };
};

export default usePasswordValidator;
