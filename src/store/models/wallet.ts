import { createModel } from "@rematch/core";
import { Modal } from "antd";
import { NODE_URL } from "../../core/config";
import Quantum from "../../core/quantum_purse";
import { transfer } from "../../core/transaction_builder";
import { sendTransaction, utf8ToBytes } from "../../core/utils";
import { RootModel } from "./index";

interface IAccount {
  name: string;
  address: string | null;
  sphincsPlusPubKey: string;
}

interface ICurrentAccount extends IAccount {
  balance: string;
}

interface IWallet {
  active: boolean;
  current: ICurrentAccount;
  accounts: IAccount[];
}

type StateType = IWallet;

let isInitializing = false;
let quantum: Quantum;

const initState: StateType = {
  active: false,
  current: {
    name: "",
    address: "",
    balance: "0",
    sphincsPlusPubKey: "",
  },
  accounts: [],
};

export const wallet = createModel<RootModel>()({
  state: initState,
  reducers: {
    setActive(state: StateType, active: boolean) {
      return { ...state, active };
    },
    setCurrent(state: StateType, current: ICurrentAccount) {
      return { ...state, current };
    },
    setAccounts(state: StateType, accounts: IAccount[]) {
      return { ...state, accounts };
    },
    reset() {
      return initState;
    },
  },
  effects: (dispatch) => ({
    async loadAccounts() {
      if (!quantum) return;
      const accounts = await quantum.getAllAccounts();
      const accountsData = accounts.map((account, index) => ({
        name: `Account ${index + 1}`,
        sphincsPlusPubKey: account,
        address: quantum.getAddress(account),
      }));
      this.setAccounts(accountsData);
      return accountsData;
    },
    async init(_, rootState) {
      if (isInitializing) return;
      isInitializing = true;
      quantum = await Quantum.getInstance();
      try {
        const accountsData: any = await this.loadAccounts();
        await quantum.setAccPointer(accountsData[0].sphincsPlusPubKey);
        this.setActive(true);
      } catch (error) {
        this.setActive(false);
        console.error("Error initializing wallet", error);
      } finally {
        isInitializing = false;
      }
    },
    async loadCurrentAccount(_, rootState) {
      if (!quantum.accountPointer || !rootState.wallet.accounts.length) return;
      const accountPointer = quantum.accountPointer;
      console.log("Load current account: ", accountPointer);
      const accountData = rootState.wallet.accounts.find(
        (account) => account.sphincsPlusPubKey === accountPointer
      );
      if (!accountData) return;
      const currentBalance = await quantum.getBalance();
      this.setCurrent({
        address: quantum.getAddress(accountPointer),
        balance: currentBalance.toString(),
        sphincsPlusPubKey: accountData.sphincsPlusPubKey,
        name: accountData.name,
      });
    },
    async createAccount(payload: { password: string }, rootState) {
      console.log("Create account: ", payload);
      await quantum.genAccount(utf8ToBytes(payload.password));
      console.log("Create account: ", quantum.accountPointer);
      await this.loadAccounts();
      await this.loadCurrentAccount({});
    },
    async createWallet({ password }, rootState) {
      await quantum.init(utf8ToBytes(password));
      await quantum.genAccount(utf8ToBytes(password));
      this.loadCurrentAccount({});
    },
    async switchAccount({ sphincsPlusPubKey }, rootState) {
      await quantum.setAccPointer(sphincsPlusPubKey);
      this.loadCurrentAccount({});
    },
    async send({ from, to, amount, password }, rootState) {
      console.log("Send: ", { from, to, amount, password });
      try {
        const tx = await transfer(from, to, amount);
        const signedTx = await quantum.sign(tx, utf8ToBytes(password));
        const txId = await sendTransaction(NODE_URL, signedTx);
        console.log("Send transaction: ", txId);
        Modal.success({
          title: "Send transaction successfully",
          content: "Send transaction successfully",
          centered: true,
          className: "global-modal",
        });
      } catch (error) {
        console.error("Send transaction failed", error);
      }
    },
    async ejectWallet() {
      await quantum.dbClear();
      this.reset();
    },
  }),
});
