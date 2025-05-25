// signer.ts
// A sphincs+ based ccc compatible signer

import {
  Signer,
  SignerType,
  SignerSignType,
  Address,
  TransactionLike,
  Transaction,
  Signature,
  BytesLike,
  ScriptLike,
  Script,
  Hex
} from "@ckb-ccc/core";
import { hexToByteArray, byteArrayToHex } from "../utils";
import { QuantumClient } from "./client";
import { IS_MAIN_NET } from "../config";
import __wbg_init, { KeyVault, SphincsVariant } from "quantum-purse-key-vault";
import { scriptToAddress } from "@nervosnetwork/ckb-sdk-utils";

export class QuantumSigner extends Signer {
  private keyVault?: KeyVault;
  private getPassword: () => Promise<Uint8Array>;
  private account: ScriptLike;

  constructor(
    client: QuantumClient,
    variant: SphincsVariant,
    getPassword: () => Promise<Uint8Array>,
    scriptInfo: ScriptLike,
  ) {
    super(client);
    this.getPassword = getPassword;

    if (this.keyVault) {
      this.keyVault.free();
    }
    this.keyVault = new KeyVault(variant);
    this.account = scriptInfo;
  }

  /* init code for wasm-bindgen module. Should be called after the construction of QuantumSigner */
  public async initWasmBindgen(): Promise<void> {
    await __wbg_init();
  }

  /** Signer type (custom) */
  get type(): SignerType {
    return "QuantumPurse" as SignerType;
  }

  /** Signature type (custom) */
  get signType(): SignerSignType {
    return "FIPS205" as SignerSignType;
  }

  /** Connect (no-op since wallet is local) */
  async connect(): Promise<void> {
    return;
  }

  /** Check connection status */
  async isConnected(): Promise<boolean> {
    return true; // Always connected. todo
  }

  /** Get internal address */
  async getInternalAddress(): Promise<string> {
    return scriptToAddress(Script.from(this.account), IS_MAIN_NET);
  }

  /** Get address objects */
  async getAddressObjs(): Promise<Address[]> {
    const lockArgs = await KeyVault.get_all_sphincs_lock_args();
    let ret: Address[] = [];
    lockArgs.forEach((args) => {
      if (!args) return;
      ret.push({
        script: Script.from({
          codeHash: this.account.codeHash,
          hashType: this.account.hashType,
          args: args,
        }),
        prefix: IS_MAIN_NET ? "ckb" : "ckt",
      });
    });
    return ret;
  }

  /** Sign message raw */
  async signMessageRaw(message: string | BytesLike): Promise<string> {
    const password = await this.getPassword();
    try {
      const signature = await this.keyVault!.sign(password, this.account.args as Hex, hexToByteArray(message as Hex));
      return byteArrayToHex(signature);
    } finally {
      password.fill(0);
    }
  }

  /** Verify message */
  async verifyMessage(message: string | BytesLike, signature: string | Signature): Promise<boolean> {
    throw new Error("verifyMessage not implemented yet");
  }

  /** Prepare transaction */
  async prepareTransaction(tx: TransactionLike): Promise<Transaction> {
    throw new Error("prepareTransaction not implemented yet");
  }

  /** Sign only the transaction */
  async signOnlyTransaction(tx: TransactionLike): Promise<Transaction> {
    throw new Error("signOnlyTransaction not implemented yet");
  }
}