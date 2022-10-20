const {compilerOptions} = require('./tsconfig.json');
compilerOptions.strict = false;

module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ["**/test/**/*.ts"],
	testPathIgnorePatterns: ['/node_modules/', "/sample/"],
	reporters: ["default", "jest-junit"],
	globals: {
		'ts-jest': {
			tsconfig: compilerOptions
		}
	},
	snapshotFormat: {
		escapeString: true,
		printBasicPrototype: true
	}
};
