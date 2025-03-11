import { createModel } from "@rematch/core";
import Quantum from "../../core/quantum_purse";
import { utf8ToBytes } from "../../core/utils";
import { RootModel } from "./index";
import { IAccount, IWallet } from "./interface";

type StateType = IWallet;

const initState: StateType = {
  active: false,
  current: {
    name: "",
    address: null,
    balance: "0",
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
      console.log("init");
      try {
        const quantum = await Quantum.getInstance();
        const accounts = await quantum.getAllAccounts();
        const currentAddress = await quantum.getAddress();
        const currentBalance = await quantum.getBalance();
        this.setAccounts(accounts);
        this.setCurrent({
          address: currentAddress,
          balance: currentBalance,
        });
        this.setActive(true);
      } catch (error) {
        this.setActive(false);
        console.error("Error initializing wallet", error);
      }
    },
    async createAccount(payload: { password: string }, rootState) {
      const quantum = await Quantum.getInstance();
      const account = await quantum.genAccount(utf8ToBytes(payload.password));
    },
    async createWallet({ password }, rootState) {
      const quantum = await Quantum.getInstance();
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

    async ejectWallet() {
      const quantum = await Quantum.getInstance();
      await quantum.dbClear();
      this.reset();
    },
  }),
});
