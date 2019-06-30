import tsccPlugin from '../../../src/index';

module.exports = {
	output: {
		dir: '.',
		format: 'iife'
	},
	plugins:[
		tsccPlugin({
			configFile: 'test/sample/many-module-build'
		})
	]
}

