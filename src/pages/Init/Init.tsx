import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { Dispatch } from "../../store";
import { RuntimeRootState } from "../../store/types";
import { ROUTES } from "../../utils/constants";

const Init: React.FC = () => {
  const wallet = useSelector<RuntimeRootState>((state) => state.wallet);
  const { init } = useDispatch<Dispatch>().wallet;

  console.log(wallet);
  useEffect(() => {
    init();
  }, [init]);

  if (wallet.active) {
    return <Navigate to={ROUTES.WALLET} />;
  } else {
    return <Navigate to={ROUTES.WELCOME} />;
  }
};

export default Init;
