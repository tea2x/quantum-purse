# QuantumPurse
A CKB quantum resistant wallet.

#### Illustration
```
+------------------+
|     Frontend     |  - User interacts here.
+------------------+
         ^
         |
         v
+------------------+
|  QuantumPurse.ts |  - Manages wallet logic (e.g., addresses, balances, transactions).
+------------------+
         ^
         |
         v
+------------------+
|   KeyVault(WASM) |  - Processes all key operations in a sandboxed environment:
|                  |    * Generates BIP39 mnemonic.
|                  |    * Derives SPHINCS+ key pairs..
|                  |    * Encrypts, Decrypts and signs transactions.
+------------------+
         ^
         |
         v
+------------------+
|    IndexedDB     |  - Stores sensitive data, always encrypted:
|                  |    * Encrypted BIP39 mnemonic.
|                  |    * Encrypted SPHINCS+ key pairs.
+------------------+
```
#### Indexed DB store model:

```
+---------------------------------+
|    seed_phrase_store(single)    |
+---------------------------------+
|  Key: "seed_phrase"             |
|  Value: CipherPayload           |
|        - salt: String           |
|        - iv: String             |
|        - cipher_text: String    |
+---------------------------------+


+---------------------------------+
|    child_keys_store(multiple)   |
+---------------------------------+
|  Key: pub_key (String)          |
|  Value: SphincsPlusKeyPair      |
|        - index: u32             |
|        - pub_key: String        |
|        - pri_enc: CipherPayload |
+---------------------------------+
```

## Prerequisited
1. Rust and Cargo, follow [this link](https://doc.rust-lang.org/cargo/getting-started/installation.html#:~:text=Install%20Rust%20and%20Cargo,rustup%20will%20also%20install%20cargo%20.) for installation.
2. wasm-pack, execute: `cargo install wasm-pack`.
3. Docker Engine/Desktop.
4. Node.

## How to use

```shell
# Install all dependencies
npm install

# Run test
npm run test

# Run in development env
npm run start

# Build a production package
npm run build

# Deploy the web app to your github
npm run deploy
```