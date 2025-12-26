import basex from 'base-x';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(BASE58);

export const createToken = () => {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const string_ = bs58.encode(randomBytes);
  return string_.padStart(22, '1').slice(0, 22); // ensure length is 22
};
