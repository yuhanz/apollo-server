const path = require('path');
const config = require('../../jest.config.base');

module.exports = Object.assign(
  {
    setupFilesAfterEnv: [
      path.resolve(__dirname, './src/__tests__/testSetup.ts'),
    ],
  },
  config,
);
