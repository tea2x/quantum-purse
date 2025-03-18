#!/bin/bash
# For CKB docker only
QP_ADDRESS=$1
docker exec -it ckb-test-node ckb-cli wallet transfer \
  --to-address "$QP_ADDRESS" \
  --to-data-path /ckb/qr-lock-script \
  --capacity 200000 \
  --privkey-path /ckb/ckb-dev-chain/pk1 \
  --skip-check-to-address

sleep 5s