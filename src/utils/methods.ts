import { CKB_DECIMALS, CKB_UNIT } from "./constants";

export const cx = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(" ");
};

export const shortenAddress = (
  address: string,
  sequenceStart = 6,
  sequenceEnd = 4
) => {
  return address.slice(0, sequenceStart) + "..." + address.slice(-sequenceEnd);
};

export const formatBalance = (balance: string) => {
  const ckbValue = BigInt(balance) / BigInt(CKB_DECIMALS);
  return (
    !!ckbValue &&
    `${ckbValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${CKB_UNIT}`
  );
};
