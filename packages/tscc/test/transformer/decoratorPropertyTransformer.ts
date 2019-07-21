///<reference types="jest" />
import * as ts from 'typescript';
import {emitWithTsickle} from 'tsickle';
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS'
import decoratorPropertyTransformer from '../../src/transformer/decoratorPropertyTransformer';
import path = require('path');

describe(`decoratorPropertyTransformer`, function () {
	test(`modifies property name access to goog.reflect.objectProperty, add @nocollapse to jsdoc`, () => {
		const testFiles = [
			"decorator/decorates"
		];
		const testFilePaths = testFiles.map(filename => path.resolve(__dirname, '../sample/', filename + '.ts'))
		const samplesRoot = path.resolve(__dirname, '../sample');
		const {out} = emit(samplesRoot, testFilePaths);

		[...out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i]);
		})

		const {out: es5Out} = emit(samplesRoot, testFilePaths, {target: ts.ScriptTarget.ES5});
		[...es5Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es5');
		})

		const {out: es3Out} = emit(samplesRoot, testFilePaths, {target: ts.ScriptTarget.ES3});
		[...es3Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es3');
		})
	})
})

function emit(tsconfigPath: string, files: string[], override: Partial<ts.CompilerOptions> = {}) {
	const {parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(tsconfigPath);
	const {options} = parsedConfig;
	Object.assign(options, override);
	const host = ts.createCompilerHost(options);
	const program = ts.createProgram(files, options, host);
	const transformerHost = {
		shouldSkipTsickleProcessing: () => false,
		shouldIgnoreWarningsForPath: () => true,
		googmodule: false,
		pathToModuleName: x => x,
		fileNameToModuleId: x => x,
		moduleResolutionHost: ts.createCompilerHost(parsedConfig.options),
		options: parsedConfig.options,
	};

	const out = new Map<string, string>();
	const {externs} = emitWithTsickle(program, transformerHost, host, options, undefined, (fileName, data) => {
		out.set(fileName, data);
	}, undefined /* cancellationtoken */, false /* emitOnlyDtsFiles */, {
			afterTs: [decoratorPropertyTransformer(transformerHost)]
		});
	return {out, externs}
}

