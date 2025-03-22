#!/bin/bash
# For CKB docker only
docker exec -it ckb-test-node ckb-cli wallet transfer \
  --to-address ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga \
  --to-data-path /ckb/qr-lock-script \
  --capacity 100000 \
  --privkey-path /ckb/ckb-dev-chain/pk1