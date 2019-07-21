///<reference types="jest"/>
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import * as ts from 'typescript';
import path = require('path');

describe(`TsccSpecWithTS`, () => {
	describe(`loadTsCOnfigFromArgs`, ()=> {

	})
	describe(`loadTsConfigFromPath`, () => {
		test(`merges compilerOptions override provided as a second argument`, () => {
			const {parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(
				path.join(__dirname, 'sample/tsconfig.1.json'),
				{
					target: 'ES2016',
					downlevelIteration: false
				}
			);
			expect(parsedConfig.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeJs);
			expect(parsedConfig.options.target).toBe(ts.ScriptTarget.ES2016);
			expect(parsedConfig.options.downlevelIteration).toBe(false);
		})
	})
});

