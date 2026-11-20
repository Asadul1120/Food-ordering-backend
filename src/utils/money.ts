export const toCents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
};

export const toMoney = (cents: bigint) => {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");

  return `${whole}.${fraction}`;
};