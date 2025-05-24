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
  Script
} from "@ckb-ccc/core";
import QuantumPurse from "../quantum_purse";
import { hexToByteArray, byteArrayToHex } from "../utils";
import { QuantumClient } from "./client";
import { IS_MAIN_NET } from "../config";

export class QuantumSigner extends Signer {
  private QP: QuantumPurse;
  private getPassword: () => Promise<Uint8Array>;

  constructor(client: QuantumClient, QP: QuantumPurse, getPassword: () => Promise<Uint8Array>) {
    super(client);
    this.QP = QuantumPurse.getInstance();
    this.getPassword = getPassword;
  }

  /** Signer type (custom for SPHINCS+) */
  get type(): SignerType {
    return "QuantumPurse" as SignerType;
  }

  /** Signature type (custom for SPHINCS+) */
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
    return this.QP.getAddress();
  }

  /** Get address objects */
  async getAddressObjs(): Promise<Address[]> {
    const lockArgs = await this.QP.getAllLockScriptArgs();
    let ret: Address[] = [];
    lockArgs.forEach((args) => {
      if (!args) return;
      ret.push({
        script: Script.from(this.QP.getLockScript(args)),
        prefix: IS_MAIN_NET ? "ckb" : "ckt",
      });
    });
    return ret;
  }

  /** Sign message raw */
  async signMessageRaw(message: string | BytesLike): Promise<string> {
    const password = await this.getPassword();
    try {
      const signature = await this.QP.signMessage(hexToByteArray(message as string), password);
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