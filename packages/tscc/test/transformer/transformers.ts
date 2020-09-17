///<reference types="jest" />
import * as ts from 'typescript';
import * as tsickle from 'tsickle';
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import decoratorPropertyTransformer from '../../src/transformer/decorator_property_transformer';
import restPropertyTransformer from '../../src/transformer/rest_property_transformer';
import path = require('path');

const samplesRoot = path.resolve(__dirname, '../sample');

describe(`decoratorPropertyTransformer`, function () {
	test(`modifies property name access to goog.reflect.objectProperty, add @nocollapse to jsdoc`, () => {
		const testFiles = [
			"decorator/decorates"
		];
		const testFilePaths = testFiles.map(
			filename => path.resolve(__dirname, '../sample/', filename + '.ts')
		);
		const emitWithDecoratorTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(samplesRoot, testFilePaths, (transformerHost) => ({
				afterTs: [decoratorPropertyTransformer(transformerHost)]
			}), override);
		}

		const {out} = emitWithDecoratorTransformations();

		[...out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i]);
		})

		const {out: es5Out} = emitWithDecoratorTransformations({target: ts.ScriptTarget.ES5});
		[...es5Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es5');
		})

		const {out: es3Out} = emitWithDecoratorTransformations({target: ts.ScriptTarget.ES3});
		[...es3Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es3');
		})
	})
})

describe(`restPropertyTransformer`, function () {
	test(`modifies property name access to goog.reflect.objectProperty`, () => {
		const testFiles = [
			"rest/case_1"
		];
		const testFilePaths = testFiles.map(
			filename => path.resolve(__dirname, '../sample/', filename + '.ts')
		);
		const emitWithRestTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(samplesRoot, testFilePaths, (transformerHost) => ({
				afterTs: [restPropertyTransformer(transformerHost)]
			}), override);
		};

		const {out} = emitWithRestTransformations();

		[...out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i]);
		})

		const {out: es5Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES5});
		[...es5Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es5');
		})

		const {out: es3Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES3});
		[...es3Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es3');
		})
	});

	test(`works well when combined with decorators`, () => {
		const testFiles = [
			"rest/combined_with_decorators"
		];
		const testFilePaths = testFiles.map(
			filename => path.resolve(__dirname, '../sample/', filename + '.ts')
		);
		const emitWithRestTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(samplesRoot, testFilePaths, (transformerHost) => ({
				afterTs: [
					decoratorPropertyTransformer(transformerHost),
					restPropertyTransformer(transformerHost)
				]
			}), override);
		};

		const {out} = emitWithRestTransformations();

		[...out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i]);
		})

		const {out: es5Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES5});
		[...es5Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es5');
		})

		const {out: es3Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES3});
		[...es3Out.values()].forEach((compiled, i) => {
			expect(compiled).toMatchSnapshot(testFiles[i] + ' - es3');
		})
	})
});

describe(`dts_requiretype_transformer`, () => {
	test.todo(`modifies requireType calls to a global variable`)
});

type EmitTransformerFactory = (host: tsickle.TsickleHost) => tsickle.EmitTransformers;

function emit(tsconfigPath: string, files: string[], transformerFactory: EmitTransformerFactory, override: Partial<ts.CompilerOptions> = {}) {
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
	const {externs} = tsickle.emitWithTsickle(
		program, transformerHost, host, options, undefined,
		(fileName, data) => {out.set(fileName, data);},
		undefined /* cancellationtoken */, false /* emitOnlyDtsFiles */,
		transformerFactory(transformerHost)
	);
	return {out, externs}
}

