///<reference types="jest"/>
import TsccSpec, {TsccSpecError} from '../src/TsccSpec';
import path = require('path');

describe(`TsccSpec`, () => {
	describe(`loadSpec`, () => {
		test(`throws when the spec file content is an invalid JSON.`, () => {
			expect(() => {
				TsccSpec.loadSpec(path.join(__dirname, 'sample/invalid_json.json'))
			}).toThrowError(TsccSpecError);
		})
	})
});

