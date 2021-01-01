///<reference types="jest"/>
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import * as ts from 'typescript';
import path = require('path');

describe(`TsccSpecWithTS`, () => {
	describe(`loadTsConfigFromArgs`, () => {
		test(`searches tsconfig from a directory provided by --project flag`, () => {
			const projectInNestedDirectory = path.join(__dirname, 'sample/nested_directory');
			const {projectRoot, parsedConfig} = TsccSpecWithTS.loadTsConfigFromArgs(
				['--project', projectInNestedDirectory],
				/** @ts-ignore */
				undefined,
				() => {}
			);
			/** @ts-ignore */
			expect(projectRoot).toBe(projectInNestedDirectory);
			expect(parsedConfig!.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeJs);
		});
	})
	describe(`loadTsConfigFromPath`, () => {
		test(`searches tsconfig from ancestor directories of specFile when tsconfig path is undefined`, () => {
			const directoryNestedInProject = path.join(
				__dirname,
				'sample/nested_directory/nested_nested_directory'
			);
			const {projectRoot, parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(
				/** @ts-ignore */
				undefined,
				directoryNestedInProject
			);
			expect(projectRoot).toBe(path.dirname(directoryNestedInProject));
			expect(parsedConfig!.options.downlevelIteration).toBe(true);
		});
		test(`merges compilerOptions override provided as a second argument`, () => {
			const {projectRoot, parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(
				path.join(__dirname, 'sample/tsconfig.1.json'),
				'/',
				{
					target: 'ES2016',
					downlevelIteration: false
				}
			);
			expect(projectRoot).toBe(path.join(__dirname, 'sample'));
			expect(parsedConfig!.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeJs);
			expect(parsedConfig!.options.target).toBe(ts.ScriptTarget.ES2016);
			expect(parsedConfig!.options.downlevelIteration).toBe(false);
		})
	})
});

