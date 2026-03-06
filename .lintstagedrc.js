export default {
  '*': (filenames) =>
    `prettier --write --ignore-unknown ${filenames.map((f) => `'${f}'`).join(' ')}`,
  'package.json': [
    () => 'syncpack fix-mismatches',
    () => 'syncpack format',
    () => 'pnpm install',
  ],
};
