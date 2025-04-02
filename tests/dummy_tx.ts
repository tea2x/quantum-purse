import { objectToTransactionSkeleton, TransactionSkeletonObject } from "@ckb-lumos/helpers";
import { Map } from 'immutable';

// Just a fake transaction for off-chain signing testing
const dummyTxObject:TransactionSkeletonObject = {
  "cellProvider": null,
  "cellDeps": [
    {
      "outPoint": {
        "txHash": "0x4300037e02b79d50000fea127ff8f1ca620eb28ddb333f76437f9fb8fbfaacb3",
        "index": "0x0"
      },
      "depType": "code"
    }
  ],
  "headerDeps": [],
  "inputs": [
    {
      "cellOutput": {
        "capacity": "0x7c0d5ad00",
        "lock": {
          "codeHash": "0x52ee8e71396abd2997f7f02697dd4c30c34d751ba7541db1817922b7add4a4a0",
          "hashType": "data1",
          "args": "0x90daff4a654b4cc030b607d9bc2be7c26c20bf6e949ce9ead05775f5669a5ef8"
        }
      },
      "data": "0x",
      "outPoint": {
        "txHash": "0x49a669eaa27fe50522ff2c3780ff3dba68ab12db9fc244e8c8345482773ce98e",
        "index": "0x0"
      }
    },
    {
      "cellOutput": {
        "capacity": "0xe113cf14e0",
        "lock": {
          "codeHash": "0x52ee8e71396abd2997f7f02697dd4c30c34d751ba7541db1817922b7add4a4a0",
          "hashType": "data1",
          "args": "0x90daff4a654b4cc030b607d9bc2be7c26c20bf6e949ce9ead05775f5669a5ef8"
        }
      },
      "data": "0x",
      "outPoint": {
        "txHash": "0x49a669eaa27fe50522ff2c3780ff3dba68ab12db9fc244e8c8345482773ce98e",
        "index": "0x1"
      }
    }
  ],
  "outputs": [
    {
      "cellOutput": {
        "capacity": "0x368d5e4700",
        "lock": {
          "codeHash": "0x52ee8e71396abd2997f7f02697dd4c30c34d751ba7541db1817922b7add4a4a0",
          "hashType": "data1",
          "args": "0x90daff4a654b4cc030b607d9bc2be7c26c20bf6e949ce9ead05775f5669a5ef8"
        }
      },
      "data": "0x"
    },
    {
      "cellOutput": {
        "capacity": "0xb247462cc0",
        "lock": {
          "codeHash": "0x52ee8e71396abd2997f7f02697dd4c30c34d751ba7541db1817922b7add4a4a0",
          "hashType": "data1",
          "args": "0x90daff4a654b4cc030b607d9bc2be7c26c20bf6e949ce9ead05775f5669a5ef8"
        }
      },
      "data": "0x"
    }
  ],
  "witnesses": [],
  "fixedEntries": [],
  "signingEntries": [],
  "inputSinces": Map<number, string>([]) as any,
}

export const dummyTx = objectToTransactionSkeleton(dummyTxObject);