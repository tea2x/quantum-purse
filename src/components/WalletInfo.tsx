import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";

const WalletInfo: React.FC = () => {
  const { address, balance } = useSelector((state: RootState) => state.wallet);

  return (
    <div>
      <h2>Wallet Information</h2>
      <p>Address: {address || "Not connected"}</p>
      <p>Balance: {balance} CKB</p>
    </div>
  );
};

export default WalletInfo;
