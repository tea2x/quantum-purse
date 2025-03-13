import { createModel } from "@rematch/core";
import Quantum from "../../core/quantum_purse";
import { utf8ToBytes, sendTransaction } from "../../core/utils";
import { RootModel } from "./index";
import { IAccount, IWallet } from "./interface";
import { transfer } from "../../core/transaction_builder";
import { NODE_URL } from "../../core/config";
import { message, Modal } from "antd";

type StateType = IWallet;

let isInitializing = false;
let quantum: Quantum;

const initState: StateType = {
  active: false,
  current: {
    name: "",
    address: null,
    balance: "0",
    sphincsPlusPubKey: "",
    index: 0,
  },
  accounts: [],
};

export const wallet = createModel<RootModel>()({
  state: initState,
  reducers: {
    setActive(state: StateType, active: boolean) {
      return { ...state, active };
    },
    setCurrent(state: StateType, current: IAccount) {
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
    async init(_, rootState) {
      if (isInitializing) return;
      isInitializing = true;
      quantum = await Quantum.getInstance();
      try {
        const accounts = await quantum.getAllAccounts();
        console.log("Load accounts: ", accounts);
        await quantum.setAccPointer(accounts[0]);
        const currentAddress = await quantum.getAddress();
        console.log("Load current address: ", currentAddress);
        const currentBalance = await quantum.getBalance();
        console.log("Load current balance: ", currentBalance);
        this.setAccounts(
          accounts.map((account, index) => ({
            name: `Account ${index + 1}`,
            sphincsPlusPubKey: account,
          }))
        );
        this.setCurrent({
          name: `Account ${1}`,
          address: currentAddress,
          balance: currentBalance.toString(),
          sphincsPlusPubKey: accounts[0],
          index: 0,
        });
        this.setActive(true);
      } catch (error) {
        this.setActive(false);
        console.error("Error initializing wallet", error);
      } finally {
        isInitializing = false;
      }
    },
    async createAccount(payload: { password: string }, rootState) {
      console.log("Create account: ", payload);
      await quantum.genAccount(utf8ToBytes(payload.password));
    },
    async createWallet({ password }, rootState) {
      await quantum.init(utf8ToBytes(password));
      await quantum.genAccount(utf8ToBytes(password));
      const address = await quantum.getAddress();
      const balance = await quantum.getBalance();
      const accounts = await quantum.getAllAccounts();
      this.setAccounts(accounts);
      this.setCurrent({
        address,
        balance,
      });
      this.setActive(true);
    },
    async switchAccount({ sphincsPlusPubKey }, rootState) {
      console.log("Switch account: ", sphincsPlusPubKey);
      await quantum.setAccPointer(sphincsPlusPubKey);
      const currentAddress = await quantum.getAddress();
      const currentBalance = await quantum.getBalance();
      const accountData = rootState.wallet.accounts.find(
        (account) => account.sphincsPlusPubKey === sphincsPlusPubKey
      );
      this.setCurrent({
        address: currentAddress,
        balance: currentBalance.toString(),
        sphincsPlusPubKey,
        name: accountData?.name,
      });
    },
    async send({ from, to, amount, password }, rootState) {
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
