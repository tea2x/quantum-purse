export const cx = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(" ");
};
