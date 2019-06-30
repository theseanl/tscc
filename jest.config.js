module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ["**/test/**/*.ts"],
	testPathIgnorePatterns: ['/node_modules/', "/sample/"],
	reporters: ["default", "jest-junit"]
};
