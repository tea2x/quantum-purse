CCC is a one-stop solution for CKB JS/TS ecosystem development developed by CKB devrel https://github.com/ckb-devrel/ccc. This sub folder contains adapters that help Quantum Purse (QP) be CCC compatible:

    - qp_client: CCC client adapter based on ckb-light-client-js
    - qp_signer: CCC signer adapter based on Quantum Purse Key Vault (SPHINCS+)

Note: In order to ensure light-client-js compatibility with CCC temporarily, Quantum Purse has to use a [fork from CCC](https://www.npmjs.com/package/ckb-ccc-core-light-client-js-patch). This fork is fairly simple and will find its way to the official CCC in the future.
