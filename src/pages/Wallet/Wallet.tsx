import { Button } from "antd";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { Dispatch } from "../../store";
import { RuntimeRootState } from "../../store/types";
import { ROUTES } from "../../utils/constants";

const Wallet: React.FC = () => {
  return (
    <div>
      <h1>Wallet</h1>
      <Button onClick={() => dispatch.wallet.ejectWallet()}>
        Eject Wallet
      </Button>
    </div>
  );
};

export default Wallet;
