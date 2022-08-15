///<reference types="jest"/>
import tsccPlugin from '../src/index';
import * as rollup from 'rollup';
import fg = require('fast-glob');
import path = require('path');

const samplesRoot = path.join(__dirname, 'sample');
// Using cwd as __dirname in order to produce jest snapshots that are independent of cwd.
// Providing cwd in order to produce jest snapshots that are independent of cwd calling jest
const bundleSpecs = <string[]>fg.sync(`*/tscc.spec.json`, {cwd: samplesRoot});

describe(`Golden Tests:`, () => {
	test.each(bundleSpecs)(`%s`, async (specPath) => {
		const specFile = path.join(samplesRoot, specPath);
		const bundle = await rollup.rollup({
			plugins: [
				tsccPlugin({specFile})
			]
		});
		const {output} = await bundle.generate({
			dir: '.',
			format: 'iife',
			interop: 'esModule'
		});


		Object.keys(output).sort().forEach(name => {
			let chunk = output[name];
			expect(chunk.code).toMatchSnapshot(chunk.name);
		})
	})
})

