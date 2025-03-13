interface IAccount {
  name: string;
  address: string | null;
  balance: string;
  sphincsPlusPubKey: string;
  index: number;
}

interface IWallet {
  active: boolean;
  current: IAccount;
  accounts: IAccount[];
}

export type { IAccount, IWallet };
