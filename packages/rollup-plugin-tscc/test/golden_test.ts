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
		const result: rollup.RollupOutput = await bundle.generate({
			dir: '.',
			format: 'iife'
		});

		result.output.forEach(
			(chunk) => {
				if ('code' in chunk)
					expect(chunk.code).toMatchSnapshot();
			}
		);
	})
})

