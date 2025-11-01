import crypto from "crypto";
import basex from "base-x";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const bs58 = basex(BASE58);

export const createToken = () => {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const str = bs58.encode(randomBytes);
  return str.padStart(22, "1").slice(0, 22); // ensure length is 22
};
