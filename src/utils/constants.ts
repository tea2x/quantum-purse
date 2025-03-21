export const ROUTES = {
  HOME: "/",
  WELCOME: "/welcome",
  COMING_SOON: "/coming-soon",
  CREATE_WALLET: "/create-wallet",
  IMPORT_WALLET: "/import-wallet",
  SEND: "/send",
  RECEIVE: "/receive",
  WALLET: "/wallet",
  DAO: {
    HOME: "/dao",
    DEPOSIT: "/dao/deposit",
    WITHDRAW: "/dao/withdraw",
    UNLOCK: "/dao/unlock",
  },
  SETTINGS: {
    HOME: "/settings",
    REVEAL_SRP: "/settings/reveal-srp",
    EJECT_WALLET: "/settings/eject-wallet",
  },
};

export const PASSWORD_ENTROPY_THRESHOLDS = {
  WEAK: 65,
  MEDIUM: 125,
  STRONG: 256,
  VERY_STRONG: 300,
};
