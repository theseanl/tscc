///<reference types="jest"/>
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import * as ts from 'typescript';
import path = require('path');
import {TsccSpecError} from '@tscc/tscc-spec';

describe(`TsccSpecWithTS`, () => {
	describe(`loadTsConfigFromArgs`, () => {
		test(`searches tsconfig from a directory provided by --project flag`, () => {
			const projectInNestedDirectory = path.join(__dirname, 'sample/nested_directory');
			const {projectRoot, parsedConfig} = TsccSpecWithTS.loadTsConfigFromArgs(
				['--project', projectInNestedDirectory],
				undefined,
				() => {}
			);
			expect(projectRoot).toBe(projectInNestedDirectory);
			expect(parsedConfig.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeJs);
		});
	})
	describe(`loadTsConfigFromPath`, () => {
		test(`searches tsconfig from ancestor directories of specFile when tsconfig path is undefined`, () => {
			const directoryNestedInProject = path.join(
				__dirname,
				'sample/nested_directory/nested_nested_directory'
			);
			const {projectRoot, parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(
				undefined,
				directoryNestedInProject
			);
			expect(projectRoot).toBe(path.dirname(directoryNestedInProject));
			expect(parsedConfig.options.downlevelIteration).toBe(true);
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
			expect(parsedConfig.options.moduleResolution).toBe(ts.ModuleResolutionKind.NodeJs);
			expect(parsedConfig.options.target).toBe(ts.ScriptTarget.ES2016);
			expect(parsedConfig.options.downlevelIteration).toBe(false);
		})
	})
	describe(`validateSpecWithTS`, () => {
		test(`throws an error when entry files in the spec isn't included in tsconfig`, () => {
			expect(() => {
				TsccSpecWithTS.loadSpecWithTS({
					modules: {
						"entry": "./non_existing_file.ts"
					}
				}, path.join(__dirname, 'sample/tsconfig.1.json'))
			}).toThrowError(TsccSpecError);
		})
	})
	describe(`pruneCompilerOptions`, () => {
		test(`Overrides "module" to "commonjs"`, () => {
			{
				const options: ts.CompilerOptions = {
					module: ts.ModuleKind.ESNext
				};
				TsccSpecWithTS.pruneCompilerOptions(options, noop);
				expect(options.module).toBe(ts.ModuleKind.CommonJS);
			}
			{
				const options2: ts.CompilerOptions = {
					module: undefined
				};
				TsccSpecWithTS.pruneCompilerOptions(options2, noop);
				expect(options2.module).toBe(ts.ModuleKind.CommonJS);
			}
		});
		test(`Make sure "target" is greater than ES3`, () => {
			{
				const options: ts.CompilerOptions = {
					target: ts.ScriptTarget.ES3
				};
				TsccSpecWithTS.pruneCompilerOptions(options, noop);
				expect(options.target).not.toBe(ts.ScriptTarget.ES3);
			}
			{
				const options2: ts.CompilerOptions = {
					target: undefined
				};
				TsccSpecWithTS.pruneCompilerOptions(options2, noop);
				expect(options2.target).toBeDefined();
			}
		})
	})
});

function noop() {}
