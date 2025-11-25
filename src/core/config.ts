// MAIN_NET flag passed in npm build command.
export const IS_MAIN_NET: boolean = (process.env.MAIN_NET === "true");

// Currently use a binary from the latest commit on https://github.com/cryptape/quantum-resistant-lock-script/
// The cell containing this binary will properly have a dead lock script with a codehash of all zeros to be Quantum Safe
// when the lockscript goes main-net. TODO replace smart contract info when deployed
export const SPHINCSPLUS_LOCK = {
  codeHash:
    "0x147ecbb5c5127d982ee1362d2c2bb4267803da2eb006d150e88af6caaa0a7eaf",
  hashType: "data1",
  outPoint: {
    txHash:
      "0x631d9a6049fb1fc3790e89d9daf35abe535b5e754cd8c3404319319710f0b106",
    index: "0x0",
  },
  depType: "code",
};

// Nervos DAO contract
export const NERVOS_DAO = IS_MAIN_NET
  ? {
    codeHash:
      "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
    hashType: "type",
    outPoint: {
      txHash:
        "0xe2fb199810d49a4d8beec56718ba2593b665db9d52299a0f9e6e75416d73ff5c",
      index: "0x2",
    },
    depType: "code",
  } : {
    codeHash:
      "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
    hashType: "type",
    outPoint: {
      txHash:
        "0x8f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f",
      index: "0x2",
    },
    depType: "code",
  };