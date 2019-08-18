///<reference types="jest"/>
import TsccSpec, {TsccSpecError} from '../src/TsccSpec';
import path = require('path');

describe(`TsccSpec`, () => {
	describe(`loadSpec`, () => {
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

