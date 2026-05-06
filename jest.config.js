export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'index.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ]
};
