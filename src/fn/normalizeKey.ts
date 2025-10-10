export const normalizeKey = (token: string, id: string): string => {
  return `${token}::${id}`;
};
