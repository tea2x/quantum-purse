import { CKB_DECIMALS, CKB_UNIT } from "./constants";

export const cx = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(" ");
};

export const shortenAddress = (address: string) => {
  return address.slice(0, 6) + "..." + address.slice(-4);
};

export const formatBalance = (balance: string) => {
  const ckbValue = BigInt(balance) / BigInt(CKB_DECIMALS);
  return (
    !!ckbValue &&
    `${ckbValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${CKB_UNIT}`
  );
};
