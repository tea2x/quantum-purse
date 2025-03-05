import { execSync } from "child_process";
import { transfer } from "../core/transaction_builder";
import QuantumPurse from "../core/quantum_purse";
import { sendTransaction } from "../core/utils";
import { utf8ToBytes } from "@noble/hashes/utils";
import * as config from "../core/config";
import { utils } from "@ckb-lumos/base";
import { readFileSync } from "fs";
const { ckbHash } = utils;

const testAccount = {
  account:
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga",
  priv_key:
    "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc",
  lock_arg: "0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7",
  receiver:
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq28phxutezqvjgfv5q38gn5kwek4m9km3cmajeqs",
};

describe("Integration Test for Quantum Purse", () => {
  jest.setTimeout(10000);
  let wallet: QuantumPurse;
  let QPAddress: string;
  const passwordStr = "my passwork is weak, don't try this";
  // const seed = QuantumPurse.generateSeedPhrase();
  const seed =
    "decide divorce toddler river dutch grit charge jacket witness \
    tip share habit cash radio spray spice try borrow stock donkey \
    whale street dragon lobster";
  const seedByte = utf8ToBytes(seed);

  beforeAll(async () => {
    console.log("[INFO] Building QR lock script...");
    execSync("make build", {
      cwd: "rust-quantum-resistant-lock-script",
      stdio: "inherit",
    });

    // update the mocked sphincs+ script hash in the config file

    console.log("[INFO] Starting CKB node...");
    execSync("bash src/test/start_ckb_node.sh", { stdio: "inherit" });

    console.log("[INFO] Deploying QR lock script...");
    const deployedTxHash = execSync("bash src/test/deploy_qr_lock_script.sh", {
      encoding: "utf-8",
      stdio: ["inherit", "pipe", "pipe"],
    }).trim();
    // Remove ANSI escape codes and update the mocked config with the deployed transaction hash
    config.SPHINCSPLUS_LOCK.outPoint.txHash = deployedTxHash.replace(
      /\x1B\[\d+m/g,
      ""
    );

    // overwrite the code hash in the mocked jest config
    const scriptBinary = readFileSync(
      "./rust-quantum-resistant-lock-script/build/release/qr-lock-script"
    );
    const codeHash = ckbHash(scriptBinary);
    config.SPHINCSPLUS_LOCK.codeHash = codeHash;

    // initialize wallet
    wallet = await QuantumPurse.getInstance();
    await wallet.genAccount(utf8ToBytes(passwordStr));

    QPAddress = wallet.getAddress();

    console.log("[INFO] Loading up CKB for test account...");
    const loadingUpTxHash = execSync(
      `bash src/test/load_up_test_account.sh ${QPAddress}`,
      {
        encoding: "utf-8",
        stdio: ["inherit", "pipe", "pipe"],
      }
    ).trim();
  });

  test("Pass - Should unlock a sphincs+ protected cell", async () => {
    let tx = await transfer(QPAddress, testAccount.account, "200");
    const signedTx = await wallet.sign(tx, utf8ToBytes(passwordStr));
    // console.log(">>>signedTx: ", JSON.stringify(signedTx, null, 2));
    await sendTransaction(config.NODE_URL, signedTx);
  });

  afterAll(() => {
    console.log("[INFO] Terminating CKB test node...");
    execSync("docker kill ckb-test-node >/dev/null 2>&1 || true", {
      stdio: "inherit",
    });
    execSync("docker rm ckb-test-node >/dev/null 2>&1 || true", {
      stdio: "inherit",
    });
  });
});
