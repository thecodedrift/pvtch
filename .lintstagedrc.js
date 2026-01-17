export default {
  '*': 'prettier --write --ignore-unknown',
  'package.json': [
    () => 'syncpack fix-mismatches',
    () => 'syncpack format',
    () => 'pnpm install',
  ],
};
