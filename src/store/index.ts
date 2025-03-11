import { init, RematchDispatch, RematchRootState } from "@rematch/core";
import { models, RootModel } from "./models";
import QuantumPurse from "../core/quantum_purse";
import { utf8ToBytes, bytesToUtf8 } from "../core/utils";

export const store = init({
  models,
});

// async function run() {
//   const passwordStr = "my password is easy to crack. Don't use this!";
//   try {
//     // console.log("Test QuantumPurse");
//     const wallet = await QuantumPurse.getInstance();

//     // await wallet.dbClear();
//     // await wallet.init(utf8ToBytes(passwordStr)); // gen and ecrypt master seed; input password is gone frome here
//     // await wallet.genAccount(utf8ToBytes(passwordStr)); // gen and encrypt a child key; input password is gone from here

//     const address = await wallet.getAddress(); // pointing to the previously generated account
//     console.log("address: ", address);

//     // get accounts list
//     const accountList = await wallet.getAllAccounts();
//     console.log("account_list: ", accountList);

//     // set account pointer to account 0
//     await wallet.setAccPointer(accountList[0]);
//     const newAddress = await wallet.getAddress();
//     console.log("new_address: ", newAddress);

//     // export to see the seed phrase
//     const seed = await wallet.exportSeedPhrase(utf8ToBytes(passwordStr)); // !! remember to clear seed !!
//     console.log("exported seed: ", bytesToUtf8(seed));

//     // import seed phrase
//     const newPasswordStr = "my password is getting strongger, right?";
//     const newSeed =
//       "comic betray load year input cruise output lock slender glory agree wink bleak topple wheel trigger pelican clap chat learn right situate oppose lava";
//     await wallet.importSeedPhrase(
//       utf8ToBytes(newSeed),
//       utf8ToBytes(newPasswordStr)
//     );

//     // re-export seed phrase
//     const newExportedSeed = await wallet.exportSeedPhrase(
//       utf8ToBytes(newPasswordStr)
//     ); // !! remember to clear seed !!
//     console.log("new exported seed: ", bytesToUtf8(newExportedSeed));
//   } catch (error) {
//     console.error("ERROR:", error);
//   }
// }

// run();

export type Store = typeof store;
export type Dispatch = RematchDispatch<RootModel>;
export type RootState = RematchRootState<RootModel>;
