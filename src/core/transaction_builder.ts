import {
  TransactionSkeleton,
  TransactionSkeletonType,
  addressToScript,
} from "@ckb-lumos/helpers";
import { common, FromInfo, parseFromInfo } from "@ckb-lumos/common-scripts";
import { addCellDep } from "@ckb-lumos/common-scripts/lib/helper";
import { CellCollector, Indexer } from "@ckb-lumos/ckb-indexer";
import {
  registerCustomLockScriptInfos,
  LockScriptInfo,
} from "@ckb-lumos/common-scripts/lib/common";
import {
  Address,
  Cell,
  CellDep,
  DepType,
  CellProvider,
  QueryOptions,
  Script,
  HashType,
} from "@ckb-lumos/base";
import {
  Config,
  getConfig,
  predefined,
  initializeConfig,
} from "@ckb-lumos/config-manager";
import { bytes } from "@ckb-lumos/codec";
import {
  CKB_INDEXER_URL,
  NODE_URL,
  FEE_RATE,
  IS_MAIN_NET,
  SPHINCSPLUS_LOCK,
} from "./config";
import { hexToInt, intToHex, prepareSigningEntries } from "./utils";
import { CKBIndexerQueryOptions } from "@ckb-lumos/ckb-indexer/src/type";

/**
 * Generates a custom CellCollector class for a specific code hash, used for Sphincs+ lock cells.
 * @param codeHash - The code hash to identify the lock script.
 * @returns A class extending the functionality to collect cells based on the script.
 */
function generateCollectorClass(codeHash: string) {
  return class SphincsPlusCellCollector {
    readonly fromScript: Script;
    readonly cellCollector: CellCollector;

    constructor(
      fromInfo: FromInfo,
      cellProvider: CellProvider,
      {
        queryOptions = {},
        config = getConfig(),
      }: { queryOptions?: QueryOptions; config?: Config }
    ) {
      if (!cellProvider) {
        throw new Error(
          `cellProvider is required when collecting JoyID-related cells`
        );
      }

      if (typeof fromInfo !== "string") {
        throw new Error(`Only the address FromInfo is supported`);
      }

      const { fromScript } = parseFromInfo(fromInfo, { config });
      this.fromScript = fromScript;

      queryOptions = {
        ...queryOptions,
        lock: this.fromScript,
        type: queryOptions.type || "empty",
        data: queryOptions.data || "0x",
      };

      this.cellCollector = cellProvider.collector(
        queryOptions
      ) as CellCollector;
    }

    async *collect(): AsyncGenerator<Cell> {
      if (!bytes.equal(this.fromScript.codeHash, codeHash)) {
        return;
      }

      for await (const inputCell of this.cellCollector.collect()) {
        yield inputCell;
      }
    }
  };
}

/**
 * Utility function to assert conditions, throwing an error if the condition is not met.
 * @param condition - The condition to check.
 * @param message - Optional message to include in the error if the assertion fails.
 */
function asserts(
  condition: unknown,
  message = "Assert failed"
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Generates lock script information for Sphics+ protocol.
 * @param codeHash - The code hash for the Sphics+ lock script.
 * @param hashType - The hash type of the script.
 * @param cellDeps - Array of cell dependencies required for the lock script.
 * @returns A LockScriptInfo object configured for Sphics+.
 */
function generateSphicsPlusLockInfo(
  codeHash: string,
  hashType: string,
  cellDeps: CellDep[]
): LockScriptInfo {
  return {
    codeHash: codeHash,
    hashType: hashType as HashType,
    lockScriptInfo: {
      CellCollector: generateCollectorClass(codeHash),
      prepareSigningEntries: prepareSigningEntries,
      async setupInputCell(txSkeleton, inputCell, _, options = {}) {
        const fromScript = inputCell.cellOutput.lock;
        asserts(
          bytes.equal(fromScript.codeHash, codeHash),
          `The input script is not Sphics+ Lock script`
        );
        // add inputCell to txSkeleton
        txSkeleton = txSkeleton.update("inputs", (inputs) =>
          inputs.push(inputCell)
        );

        const output: Cell = {
          cellOutput: {
            capacity: inputCell.cellOutput.capacity,
            lock: inputCell.cellOutput.lock,
            type: inputCell.cellOutput.type,
          },
          data: inputCell.data,
        };

        txSkeleton = txSkeleton.update("outputs", (outputs) =>
          outputs.push(output)
        );

        const since = options.since;
        if (since) {
          txSkeleton = txSkeleton.update("inputSinces", (inputSinces) => {
            return inputSinces.set(txSkeleton.get("inputs").size - 1, since);
          });
        }

        cellDeps.forEach((item) => {
          txSkeleton = addCellDep(txSkeleton, item);
        });

        return txSkeleton;
      },
    },
  };
}

/**
 * Builds a CKB transaction for transferring assets from one address to another using Lumos helpers.
 *
 * @param from - The sender's address.
 * @param to - The recipient's address.
 * @param amount - The amount in shannon to transfer as a string (for precision).
 * @returns A Promise that resolves to a TransactionSkeletonType object.
 * @throws Error if the transaction cannot be built due to invalid input or network issues.
 */
export async function lummosTransfer(
  from: Address,
  to: Address,
  amount: string
): Promise<TransactionSkeletonType> {
  let testnetSphincsLock: LockScriptInfo = generateSphicsPlusLockInfo(
    SPHINCSPLUS_LOCK.codeHash,
    SPHINCSPLUS_LOCK.hashType,
    [
      {
        outPoint: SPHINCSPLUS_LOCK.outPoint,
        depType: SPHINCSPLUS_LOCK.depType as DepType,
      },
    ]
  );

  // register Sphics+ Lockscript infomation
  registerCustomLockScriptInfos([testnetSphincsLock]);
  const indexer = new Indexer(CKB_INDEXER_URL as string, NODE_URL as string);

  let configuration;
  if (IS_MAIN_NET) {
    configuration = predefined.LINA;
  } else {
    configuration = predefined.AGGRON4;
  }

  let txSkeleton = new TransactionSkeleton({ cellProvider: indexer });
  txSkeleton = await common.transfer(
    txSkeleton,
    [from],
    to,
    amount, //TODO
    undefined,
    undefined,
    {
      config: configuration,
    }
  );

  txSkeleton = await common.payFeeByFeeRate(
    txSkeleton,
    [from],
    BigInt(FEE_RATE),
    undefined,
    {
      config: configuration,
    }
  );

  return txSkeleton;
}

/**
 * Assemble a CKB transaction without relying on lumos common.transfer for more manual control.
 *
 * @param from - The sender's address.
 * @param to - The recipient's address.
 * @param amount - The amount to transfer in CKB.
 * @returns A Promise that resolves to a TransactionSkeletonType object.
 * @throws Error if the transaction cannot be built due to insufficient balance or network issues.
 */
export async function transfer(
  from: Address,
  to: Address,
  amount: string
): Promise<TransactionSkeletonType> {
  const indexer = new Indexer(CKB_INDEXER_URL as string, NODE_URL as string);

  const txFee = BigInt(20000);
  let configuration: Config;
  if (IS_MAIN_NET) {
    configuration = predefined.LINA;
  } else {
    configuration = predefined.AGGRON4;
  }
  initializeConfig(configuration);

  let txSkeleton = new TransactionSkeleton({ cellProvider: indexer });

  // add sphics+ celldep
  txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
    cellDeps.push({
      outPoint: SPHINCSPLUS_LOCK.outPoint,
      depType: SPHINCSPLUS_LOCK.depType as DepType,
    })
  );

  // add input cells
  const minimalSphincsPlusCapacity = BigInt(73) * BigInt(100000000);
  const outputCapacity = BigInt(amount) * BigInt(100000000);
  let requiredCapacity = outputCapacity + minimalSphincsPlusCapacity + txFee;

  let query: CKBIndexerQueryOptions = {
    lock: addressToScript(from),
    type: "empty",
  };
  const cellCollector = new CellCollector(indexer, query);
  let inputCells: Cell[] = [];
  let inputCapacity = BigInt(0);
  for await (const cell of cellCollector.collect()) {
    inputCells.push(cell);
    inputCapacity += hexToInt(cell.cellOutput.capacity);

    if (inputCapacity >= requiredCapacity) break;
  }

  if (inputCapacity < requiredCapacity)
    throw new Error("Insufficient balance!");

  txSkeleton = txSkeleton.update("inputs", (i) => i.concat(inputCells));

  // add output
  const output: Cell = {
    cellOutput: {
      capacity: intToHex(Number(outputCapacity)),
      lock: addressToScript(to),
      type: undefined,
    },
    data: "0x",
  };
  txSkeleton = txSkeleton.update("outputs", (o) => o.push(output));

  // add change cell
  const changeCapacity = intToHex(
    Number(inputCapacity - outputCapacity - txFee)
  );
  const changeCell: Cell = {
    cellOutput: {
      capacity: changeCapacity,
      lock: addressToScript(from),
      type: undefined,
    },
    data: "0x",
  };
  txSkeleton = txSkeleton.update("outputs", (o) => o.push(changeCell));

  return txSkeleton;
}

/**
 * Assemble a dummy CKB transaction for testing purposes.
 *
 * @returns A Promise that resolves to a TransactionSkeletonType object.
 */
export async function buildDummyTx(): Promise<TransactionSkeletonType> {
  let txSkeleton = new TransactionSkeleton();
  return txSkeleton;
}