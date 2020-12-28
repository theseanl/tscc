///<reference types="jest" />
import * as ts from 'typescript';
import * as tsickle from 'tsickle';
import TsccSpecWithTS from '../../src/spec/TsccSpecWithTS';
import decoratorPropertyTransformer from '../../src/transformer/decorator_property_transformer';
import restPropertyTransformer from '../../src/transformer/rest_property_transformer';
import dtsRequireTypeTransformer from '../../src/transformer/dts_requiretype_transformer';
import ITsccSpecWithTS from '../../src/spec/ITsccSpecWithTS';
import {escapeGoogAdmissibleName} from '../../src/shared/escape_goog_identifier';
import path = require('path');
import upath = require('upath');

const samplesRoot = path.resolve(__dirname, '../sample');

describe(`decoratorPropertyTransformer`, function () {
	test(`modifies property name access to goog.reflect.objectProperty, add @nocollapse to jsdoc`, () => {
		const testFiles = [
			"decorator/decorates.ts"
		];

		const emitWithDecoratorTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(testFiles, (transformerHost) => ({
				afterTs: [decoratorPropertyTransformer(transformerHost)]
			}), override);
		}

		const {out} = emitWithDecoratorTransformations();
		for (let testFile of testFiles) {
			expect(out.get(testFile)).toMatchSnapshot(testFile);
		}

		const {out: es5Out} = emitWithDecoratorTransformations({target: ts.ScriptTarget.ES5});
		for (let testFile of testFiles) {
			expect(es5Out.get(testFile)).toMatchSnapshot(testFile + ' - es5');
		}

		const {out: es3Out} = emitWithDecoratorTransformations({target: ts.ScriptTarget.ES3});
		for (let testFile of testFiles) {
			expect(es3Out.get(testFile)).toMatchSnapshot(testFile + ' - es3');
		}
	})
})

describe(`restPropertyTransformer`, function () {
	test(`modifies property name access to goog.reflect.objectProperty`, () => {
		const testFiles = [
			"rest/case_1.ts"
		];

		const emitWithRestTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(testFiles, (transformerHost) => ({
				afterTs: [restPropertyTransformer(transformerHost)]
			}), override);
		};

		const {out} = emitWithRestTransformations();
		for (let testFile of testFiles) {
			expect(out.get(testFile)).toMatchSnapshot(testFile);
		}

		const {out: es5Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES5});
		for (let testFile of testFiles) {
			expect(es5Out.get(testFile)).toMatchSnapshot(testFile + ' - es5');
		}

		const {out: es3Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES3});
		for (let testFile of testFiles) {
			expect(es3Out.get(testFile)).toMatchSnapshot(testFile + ' - es3');
		}
	});

	test(`works well when combined with decorators`, () => {
		const testFiles = [
			"rest/combined_with_decorators.ts"
		];

		const emitWithRestTransformations = (override?: Partial<ts.CompilerOptions>) => {
			return emit(testFiles, (transformerHost) => ({
				afterTs: [
					decoratorPropertyTransformer(transformerHost),
					restPropertyTransformer(transformerHost)
				]
			}), override);
		};

		const {out} = emitWithRestTransformations();
		for (let testFile of testFiles) {
			expect(out.get(testFile)).toMatchSnapshot(testFile);
		}

		const {out: es5Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES5});
		for (let testFile of testFiles) {
			expect(es5Out.get(testFile)).toMatchSnapshot(testFile + ' - es5');
		}

		const {out: es3Out} = emitWithRestTransformations({target: ts.ScriptTarget.ES3});
		for (let testFile of testFiles) {
			expect(es3Out.get(testFile)).toMatchSnapshot(testFile + ' - es3');
		}
	})
});

describe(`dts_requiretype_transformer`, () => {
	test(`modifies requireType calls to a global variable`, () => {
		const testFiles = [
			"dts_requiretype/entry.ts"
		];

		const mockSpec = <TsccSpecWithTS>{
			getTSRoot() {
				return samplesRoot;
			},
			getExternalModuleNames() {
				return []
			}
		};

		const tsickleHostOverride: Partial<tsickle.TsickleHost> = {
			googmodule: true,
			transformTypesToClosure: true,
			pathToModuleName(context, fileName) {
				// TODO: Having to depend on actual escapeGoog function here looks bad.
				// We have to decouple this test from an actual implementation. Maybe introduce a
				// tsccHost object that contains escapeGoog** and instantiate tsickleHost using that.
				// Currently
				if (/tslib/.test(fileName)) return 'tslib';
				if (context.length > 0) fileName = path.resolve(path.dirname(context), fileName);
				const rel = path.relative(samplesRoot, fileName);
				return escapeGoogAdmissibleName(rel);
			},
			fileNameToModuleId: x => ""
		};

		const {out} = emit(testFiles, (transformerHost) => ({
			afterTs: [dtsRequireTypeTransformer(mockSpec, transformerHost)]
		}), {}, tsickleHostOverride);

		for (let testFile of testFiles) 
			expect(out.get(testFile)).toMatchSnapshot(testFile);
	})
});

type EmitTransformerFactory = (host: tsickle.TsickleHost) => tsickle.EmitTransformers;

function emit(
	files: string[], transformerFactory: EmitTransformerFactory,
	override: Partial<ts.CompilerOptions> = {}, tsickleHostOverride: Partial<tsickle.TsickleHost> = {}
) {
	const {parsedConfig} = TsccSpecWithTS.loadTsConfigFromPath(samplesRoot);
	const {options} = parsedConfig;
	Object.assign(options, override);
	const host = ts.createCompilerHost(options);
	files = files.map(file => path.resolve(samplesRoot, file));
	const program = ts.createProgram(files, options, host);
	const transformerHost = Object.assign({
		shouldSkipTsickleProcessing: () => false,
		shouldIgnoreWarningsForPath: () => true,
		googmodule: false,
		pathToModuleName: x => x,
		fileNameToModuleId: x => x,
		moduleResolutionHost: ts.createCompilerHost(parsedConfig.options),
		options,
	}, tsickleHostOverride);

	const out = new Map<string, string>();
	const {externs} = tsickle.emitWithTsickle(
		program, transformerHost, host, options, undefined,
		(fileName, data) => {
			fileName = path.relative(samplesRoot, fileName);
			fileName = fileName.slice(0, -path.extname(fileName).length) + '.ts';
			fileName = upath.toUnix(fileName); // so that test outputs are independent of platforms
			out.set(fileName, data);
		},
		undefined /* cancellationtoken */, false /* emitOnlyDtsFiles */,
		transformerFactory(transformerHost)
	);
	return {out, externs}
}
