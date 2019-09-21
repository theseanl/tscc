///<reference types="jest"/>
import TsccSpec, {TsccSpecError} from '../src/TsccSpec';
import path = require('path');
import process = require('process');

describe(`TsccSpec`, () => {
	describe(`loadSpec`, () => {
		const testSpecDir = path.join(__dirname, 'sample');

		test(`loads spec file from a specified directory`, () => {
			const spec = TsccSpec.loadSpec(testSpecDir);
			expect(spec.getOrderedModuleSpecs().length).toBe(1);
		});

		test(`loads spec from a directory specified via specFile key`, () => {
			const spec = TsccSpec.loadSpec({specFile: testSpecDir});
			expect(spec.getOrderedModuleSpecs().length).toBe(1);
		});

		test(`loads spec by searching on ancestor directories starting from CWD`, () => {
			const done = mockCurrentWorkingDirectory(path.join(testSpecDir, 'nested_directory'));

			const spec = TsccSpec.loadSpec(undefined);
			expect(spec.getOrderedModuleSpecs().length).toBe(1);

			done();
		});

		test(`ancestor directory search stops at the root directory`, () => {
			const nonExistentPath = path.sep + new Array(5).fill(1).map(() => {
				return Math.random().toString(36).substring(2);
			}).join(path.sep);

			const done = mockCurrentWorkingDirectory(nonExistentPath);

			expect(() => {
				TsccSpec.loadSpec(undefined)
			}).toThrow(TsccSpecError);
			// ancestor directory search eventually stops at and throws
			// a not found error.

			done();
		});

		test(`when it cannot find a spec file at a path referenced via specFile key, throws an error with meaningful error message`, () => {
			let errorThrown: Error;
			try {
				TsccSpec.loadSpec({specFile: '/'});
			} catch (e) {
				errorThrown = e;
			}
			expect(errorThrown).toBeTruthy();
			expect(errorThrown.message).toBe(`No spec file was found from /.`);
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

function mockCurrentWorkingDirectory(mockValue: string) {
	const spy = jest.spyOn(process, 'cwd');
	spy.mockReturnValue(mockValue);
	return () => {spy.mockRestore();}
}
