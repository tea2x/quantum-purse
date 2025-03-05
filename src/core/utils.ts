import {
  utils,
  blockchain,
  HexString,
  values,
  Transaction,
} from "@ckb-lumos/base";
const { ckbHash, CKBHasher, computeScriptHash } = utils;
import {
  TransactionSkeletonType,
  createTransactionFromSkeleton,
} from "@ckb-lumos/helpers";
import { Set } from "immutable";
import { BI } from "@ckb-lumos/bi";
import { bytes } from "@ckb-lumos/codec";
import { SPHINCSPLUS_LOCK } from "./config";
import { RPC } from "@ckb-lumos/rpc";

/**
 * Converts a hexadecimal string to a BigInt number, handling both positive and negative values.
 * @param hex - The hexadecimal string to convert.
 * @returns A BigInt representation of the hex value.
 * @throws {Error} If the hex string doesn't start with '0x' or '-0x'.
 */
export function hexToInt(hex: string) {
  if (hex.substr(0, 2) !== "0x" && hex.substr(0, 3) !== "-0x")
    throw new Error(`Invalid hex value: "${hex}"`);

  const negative = hex[0] === "-";
  const hexValue = hex.replace("-", "");
  let bigInt = BigInt(hexValue);
  if (negative) bigInt *= BigInt(-1);

  if (negative)
    console.warn(
      "Warning: A negative value was passed to hexToInt(). This usually means there has been a capacity miscalculation."
    );

  return bigInt;
}

/**
 * Converts a number to its hexadecimal string representation with optional padding.
 * @param num - The number to convert.
 * @param padding - Optional padding to ensure a fixed hex string length.
 * @returns A hexadecimal string prefixed with '0x' or '-0x' for negative numbers.
 */
export function intToHex(num: number, padding = 0) {
  let bigNum = BigInt(num);
  const negative = bigNum < BigInt(0);
  const prefix = !negative ? "0x" : "-0x";
  if (negative) bigNum *= BigInt(-1);
  let hexValue = bigNum.toString(16);

  if (padding !== 0) {
    while (hexValue.length < padding) {
      hexValue = "0" + hexValue;
    }
  }

  hexValue = prefix + hexValue;

  if (negative)
    console.warn(
      "Warning: A negative value was passed to intToHex(). This usually means there has been a miscalculation."
    );

  return hexValue;
}

/**
 * Overrides the default fetch function to fix 'Illegal invocation' errors in some environments.
 * @param request - The resource to fetch, can be a string, URL, or Request object.
 * @param init - Optional fetch options.
 * @returns A Promise that resolves to the Response object.
 */
export function fetch(
  request: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(request, {
    ...init,
  });
}

/**
 * Hashes the length of a witness and the witness itself for signing purposes.
 * @param hasher - An object with an update method for hashing data.
 * @param witness - The witness to hash as a HexString.
 */
function hashWitness(
  hasher: { update: (value: HexString | ArrayBuffer) => unknown },
  witness: HexString
): void {
  const lengthBuffer = new ArrayBuffer(8);
  const view = new DataView(lengthBuffer);
  const witnessHexString = BI.from(bytes.bytify(witness).length).toString(16);
  if (witnessHexString.length <= 8) {
    view.setUint32(0, Number("0x" + witnessHexString), true);
    view.setUint32(4, Number("0x" + "00000000"), true);
  }

  if (witnessHexString.length > 8 && witnessHexString.length <= 16) {
    view.setUint32(0, Number("0x" + witnessHexString.slice(-8)), true);
    view.setUint32(4, Number("0x" + witnessHexString.slice(0, -8)), true);
  }
  hasher.update(lengthBuffer);
  hasher.update(witness);
}

/**
 * Inserts placeholder witnesses into a transaction skeleton for SPHINCS+ signatures.
 * @param transaction - The transaction skeleton to modify.
 * @param spSigSize - The size of the SPHINCS+ signature in bytes.
 * @returns The modified transaction skeleton.
 * @throws {Error} If the transaction already has witnesses.
 */
export function insertWitnessPlaceHolder(
  transaction: TransactionSkeletonType,
  spSigSize: number
): TransactionSkeletonType {
  if (transaction.witnesses.size !== 0)
    throw new Error(
      "This function can only be used on an empty witnesses structure."
    );

  let uniqueLocks = Set<string>();
  for (const input of transaction.inputs) {
    let witness = "0x";

    const lockHash = computeScriptHash(input.cellOutput.lock);
    if (!uniqueLocks.has(lockHash)) {
      uniqueLocks = uniqueLocks.add(lockHash);
      if (
        input.cellOutput.lock.hashType === SPHINCSPLUS_LOCK.hashType &&
        input.cellOutput.lock.codeHash === SPHINCSPLUS_LOCK.codeHash
      )
        witness = "0x" + "0".repeat(spSigSize * 2);
    }

    witness = bytes.hexify(blockchain.WitnessArgs.pack({ lock: witness }));
    transaction = transaction.update("witnesses", (w) => w.push(witness));
  }

  return transaction;
}

/**
 * Prepares signing entries for SPHINCS+ by hashing transaction data and witness information.
 * @param txSkeleton - The transaction skeleton to process.
 * @returns An updated transaction skeleton with signing entries.
 */
export function prepareSphincsPlusSigningEntries(
  txSkeleton: TransactionSkeletonType
): TransactionSkeletonType {
  let processedArgs = Set<string>();
  const tx = createTransactionFromSkeleton(txSkeleton);
  const txHash = ckbHash(blockchain.RawTransaction.pack(tx));
  const inputs = txSkeleton.get("inputs");
  const witnesses = txSkeleton.get("witnesses");
  let signingEntries = txSkeleton.get("signingEntries");
  for (let i = 0; i < inputs.size; i++) {
    const input = inputs.get(i)!;
    if (!processedArgs.has(input.cellOutput.lock.args)) {
      processedArgs = processedArgs.add(input.cellOutput.lock.args);
      const lockValue = new values.ScriptValue(input.cellOutput.lock, {
        validate: false,
      });
      const hasher = new CKBHasher();
      hasher.update(txHash);
      if (i >= witnesses.size) {
        throw new Error(
          `The first witness in the script group starting at input index ${i} does not exist,\
           maybe some other part has invalidly tampered the transaction?`
        );
      }
      hashWitness(hasher, witnesses.get(i)!);
      for (let j = i + 1; j < inputs.size && j < witnesses.size; j++) {
        const otherInput = inputs.get(j)!;
        if (
          lockValue.equals(
            new values.ScriptValue(otherInput.cellOutput.lock, {
              validate: false,
            })
          )
        ) {
          hashWitness(hasher, witnesses.get(j)!);
        }
      }
      for (let j = inputs.size; j < witnesses.size; j++) {
        hashWitness(hasher, witnesses.get(j)!);
      }
      const signingEntry = {
        type: "witness_args_lock",
        index: i,
        message: hasher.digestHex(),
      };
      signingEntries = signingEntries.push(signingEntry);
    }
  }
  txSkeleton = txSkeleton.set("signingEntries", signingEntries);
  return txSkeleton;
}

/**
 * Sends a signed transaction to the CKB node.
 * @param nodeURL - The URL of the CKB node.
 * @param signedTx - The signed transaction to send.
 * @returns A promise resolving to the transaction ID.
 * @throws {Error} If there's an error sending the transaction, with detailed error information.
 */
export async function sendTransaction(nodeURL: string, signedTx: Transaction) {
  const rpc = new RPC(nodeURL, { fetch });

  let txid = "";
  try {
    txid = await rpc.sendTransaction(signedTx);
  } catch (error: any) {
    const regex = /^(\w+): ([\w\s]+) (\{.*\})$/;
    const matches = error.message.match(regex);

    if (!!matches && matches.length > 0) {
      const category = matches[1];
      const type = matches[2];
      const json = JSON.parse(matches[3]);

      console.log();
      console.error(`Error: ${category}`);
      console.error(`Type: ${type}`);
      console.error(`Code: ${json.code}`);
      console.error(`Message: ${json.message}`);
      console.error(`Data: ${json.data}`);
      console.log();

      throw new Error("RPC Returned Error!");
    } else {
      throw error;
    }
  }

  return txid;
}

/**
 * Waits for a transaction to be confirmed on the blockchain.
 * @param nodeURL - The URL of the CKB node to monitor.
 * @param txid - The transaction ID to wait for.
 */
export async function waitForTransactionConfirmation(
  nodeURL: string,
  txid: string
) {
  process.stdout.write("Waiting for transaction to confirm.");
  await waitForConfirmation(
    nodeURL,
    txid,
    (_status) => process.stdout.write("."),
    { recheckMs: 1_000 }
  );
}

/**
 * Generic function to wait for transaction confirmation with custom progress updates.
 * @param nodeURL - The URL of the CKB node to query.
 * @param txid - The transaction ID to confirm.
 * @param updateProgress - Callback to update progress, defaults to a no-op.
 * @param options - Configuration options for timeout, retry intervals, etc.
 * @returns A promise that resolves when the transaction is confirmed.
 * @throws {Error} If there's a timeout or transaction not found (if specified).
 */
export async function waitForConfirmation(
  nodeURL: string,
  txid: string,
  updateProgress = (_status: any) => {},
  options: any
) {
  const defaults = {
    timeoutMs: 300_000,
    recheckMs: 250,
    throwOnNotFound: true,
  };
  options = { ...defaults, ...options };

  return new Promise(async (resolve, reject) => {
    let timedOut = false;
    const timeoutTimer =
      options.timeoutMs !== 0
        ? setTimeout(() => {
            timedOut = true;
          }, options.timeoutMs)
        : false;
    const rpc = new RPC(nodeURL, { fetch });

    while (true) {
      if (timedOut) return reject(Error("Transaction timeout."));

      const transaction = await rpc.getTransaction(txid);

      if (!!transaction) {
        const status = transaction.txStatus.status;

        updateProgress(status);

        if (status === "committed") {
          if (timeoutTimer) clearTimeout(timeoutTimer);

          break;
        }
      } else if (transaction === null) {
        if (options.throwOnNotFound)
          return reject(Error("Transaction was not found."));
        else updateProgress("not_found");
      }

      await new Promise((resolve) => setTimeout(resolve, options.recheckMs));
    }

    return resolve;
  });
}

/**
 * Converts a hex string to a Uint8Array.
 * @param hex - The hex string to convert.
 * @returns A Uint8Array representing the hex string.
 */
export function hexStringToUint8Array(hex: string): Uint8Array {
  if (hex.startsWith("0x")) {
    hex = hex.slice(2);
  }

  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }

  const byteArray = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    byteArray[i / 2] = parseInt(hex.substr(i, 2), 16);
  }

  return byteArray;
}

/**
 * Converts a Uint8Array to a hex string.
 * @param arr - The uint8 array to convert.
 * @returns A hex string.
 */
export function uint8ArrayToHexString(arr: Uint8Array): string {
  return "0x" + Array.from(arr)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert JS string to byte array.
 * @example utf8ToBytes('abc') // new Uint8Array([97, 98, 99])
 */
export function utf8ToBytes(str: string): Uint8Array {
  if (typeof str !== 'string') throw new Error('utf8ToBytes expected string, got ' + typeof str);
  return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}

/**
 * Converts a utf8 byte encoded as uint8raay to the utf8.
 * @param arr - The uint8 array to convert.
 * @returns A hex string.
 */
export function bytesToUtf8(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('bytesToUtf8 expected Uint8Array, got ' + typeof bytes);
  }
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}