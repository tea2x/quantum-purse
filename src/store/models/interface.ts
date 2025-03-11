interface IAccount {
  name: string;
  address: string | null;
  balance: string;
}

interface IWallet {
  active: boolean;
  current: IAccount;
  accounts: IAccount[];
}

export type { IAccount, IWallet };
