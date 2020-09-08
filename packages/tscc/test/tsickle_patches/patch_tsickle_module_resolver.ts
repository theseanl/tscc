import {getPackageBoundary} from '../../src/tsickle_patches/patch_tsickle_module_resolver';

describe(`getPackageBoundary`, () => {
	test(`extracts the latest (closest) directory when multiple node_modules are present in the path`, () => {
		expect(getPackageBoundary(`/a/b/c/d/e/node_modules/f/g/h/node_modules/i/j/k`))
			.toBe(`/a/b/c/d/e/node_modules/f/g/h/node_modules/i/`);
	})
	test(`extracts scoped package boundaries correctly`, () => {
		expect(getPackageBoundary(`/a/b/c/d/node_modules/@e/f/g/h`))
			.toBe(`/a/b/c/d/node_modules/@e/f/`);
	})
})
