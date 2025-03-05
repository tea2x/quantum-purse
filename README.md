# QuantumPurse 0.0.1
A CKB quantum resistant wallet.

## How to use

```shell
# Install all dependencies
npm install

# Run test - Docker REQUIRED!
npm run test

# Run in development env
npm run start

# Build a production package
npm run build

# Deploy the web app to your github
npm run deploy
```

## For testing and contribution
 - prerequisites: Docker



## Usage Example

Below is a sample code snippet demonstrating how to use the core functionality in `src/index.ts`:

```typescript
import "./styles.css";
import Icon from "./icon.png";
import { transfer } from "./core/transaction_builder";
import { sendTransaction } from "./core/utils";
import { NODE_URL } from "./core/config";
import QuantumPurse from "./core/quantum_purse";
import { utf8ToBytes, bytesToUtf8 } from "./core/utils";

// Add title
const text = "A quantum resistant wallet for ckb blockchain";
const $content = document.querySelector("#content");
if ($content) {
  $content.textContent = text;
}

// Add the icon
const myIcon = new Image();
myIcon.src = Icon;
document.body.appendChild(myIcon);

/////////////////////////////////////////////////////////////////////
async function run() {
  const passwordStr = "my password is easy to crack. Don't use this!";
  try {
    const wallet = await QuantumPurse.getInstance();

    await wallet.dbClear();
    await wallet.init(utf8ToBytes(passwordStr)); // gen and ecrypt master seed; input password is gone frome here
    await wallet.genAccount(utf8ToBytes(passwordStr)); // gen and encrypt a child key; input password is gone from here

    const address = await wallet.getAddress(); // pointing to the previously generated account
    console.log("address: ", address);

    // get accounts list
    const accountList = await wallet.getAllAccounts();
    console.log("account_list: ", accountList);

    // set account pointer to account 0
    await wallet.setAccPointer(accountList[0]);
    const newAddress = await wallet.getAddress();
    console.log("new_address: ", newAddress);

    // export to see the seed phrase
    const seed = await wallet.exportSeedPhrase(utf8ToBytes(passwordStr)); // !! remember to clear seed !!
    console.log("exported seed: ", bytesToUtf8(seed));

    // import seed phrase
    const newPasswordStr = "my password is getting strongger, right?";
    const newSeed = "comic betray load year input cruise output lock slender glory agree wink bleak topple wheel trigger pelican clap chat learn right situate oppose lava";
    await wallet.importSeedPhrase(utf8ToBytes(newSeed), utf8ToBytes(newPasswordStr))

    // re-export seed phrase
    const newExportedSeed = await wallet.exportSeedPhrase(utf8ToBytes(newPasswordStr)); // !! remember to clear seed !!
    console.log("new exported seed: ", bytesToUtf8(newExportedSeed));
  } catch (error) {
    console.error("ERROR:", error);
  }
}

run();
/////////////////////////////////////////////////////////////////////
```