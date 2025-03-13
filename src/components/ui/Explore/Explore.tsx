import { CKB_EXPLORER_URL } from "../../../utils/constants";

interface ExploreTransactionProps {
  txId: string;
}

const Transaction: React.FC<ExploreTransactionProps> = ({ txId }) => {
  return (
    <a
      href={`${CKB_EXPLORER_URL}/transaction/${txId}`}
      target="_blank"
      rel="noreferrer"
    >
      {txId}
    </a>
  );
};

interface ExploreAccountProps {
  address: string;
}

const Account: React.FC<ExploreAccountProps> = ({ address }) => {
  return (
    <a
      href={`${CKB_EXPLORER_URL}/address/${address}`}
      target="_blank"
      rel="noreferrer"
    >
      {address}
    </a>
  );
};

export const Explore = {
  Transaction,
  Account,
};
