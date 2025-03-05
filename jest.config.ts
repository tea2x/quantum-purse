module.exports = {
  preset: 'ts-jest',
  testEnvironment: './jest.env.custom.js',
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};