///<reference types="jest"/>
import TsccSpec, {TsccSpecError} from '../src/TsccSpec';
import path = require('path');
import process = require('process');

describe(`TsccSpec`, () => {
	describe(`loadSpec`, () => {
		const testSpecDir = path.join(__dirname, 'sample');
		const testSpecPath = path.join(testSpecDir, 'tscc.spec.json');

		test(`loads spec file from a specified directory`, () => {
			const spec = TsccSpec.loadSpec(testSpecDir);
			expect(spec.getOrderedModuleSpecs().length).toBe(1);
		});

		test(`loads spec by searching on ancestor directories starting from CWD`, () => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(path.join(testSpecDir, 'nested_directory'));

			const spec = TsccSpec.loadSpec(undefined);
			expect(spec.getOrderedModuleSpecs().length).toBe(1);

			spy.mockRestore();
		});

		const invalidSpecJSONPath = path.join(__dirname, 'sample/invalid_json.json');

		test(`throws when the spec file content is an invalid JSON.`, () => {
			expect(() => {
				TsccSpec.loadSpec(invalidSpecJSONPath)
			}).toThrowError(TsccSpecError);
		});
		test(`throws when the spec file referenced via "specFile" key is an invalid JSON.`, () => {
			expect(() => {
				TsccSpec.loadSpec({specFile: invalidSpecJSONPath})
			}).toThrowError(TsccSpecError);
		});
	})
});

