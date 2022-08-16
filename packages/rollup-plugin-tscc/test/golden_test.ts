///<reference types="jest"/>
import tsccPlugin from '../src/index';
import * as rollup from 'rollup';
import fg = require('fast-glob');
import path = require('path');
import upath = require('upath');

const samplesRoot = path.join(__dirname, 'sample');
// Using cwd as __dirname in order to produce jest snapshots that are independent of cwd.
// Providing cwd in order to produce jest snapshots that are independent of cwd calling jest

function upathGlob(glob: string): string[] {
	return fg.sync(glob, {cwd: samplesRoot})
		.map(p => upath.toUnix(p)); // Normalize so that snapshots have the same name on Linux and on Windows
}

describe(`Golden Tests:`, () => {
	const bundleSpecs = upathGlob(`*/tscc.spec.json`);
	const moduleBundleSpecs = upathGlob(`*/tscc.spec.module.json`);

	test.each(bundleSpecs)(`%s`, testBundle);
	test.each(moduleBundleSpecs)(`%s module`, testBundle);
})

async function testBundle(specPath: string) {
	const specFile = path.join(samplesRoot, specPath);
	const bundle = await rollup.rollup({
		plugins: [
			tsccPlugin({specFile})
		],
		onwarn(warning, warn) {
			// Silence warning "The 'this' keyword is equivalent to 'undefined' at the top level of
			// an ES module, and has been rewritten"
			if (warning.code === 'THIS_IS_UNDEFINED') return;
			warn(warning);
		}
	});
	const {output} = await bundle.generate({
		dir: '.',
		interop: 'esModule'
	});

	Object.keys(output).sort().forEach(name => {
		let chunk = output[name];
		let normalizedChunkFileName = upath.toUnix(chunk.fileName);
		expect(chunk.code).toMatchSnapshot(normalizedChunkFileName);
	})
}
