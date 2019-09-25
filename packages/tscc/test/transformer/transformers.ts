///<reference types="jest" />
import * as ts from 'typescript';
import decoratorPropertyTransformer from '../../src/transformer/decoratorPropertyTransformer';
import restPropertyTransformer from '../../src/transformer/restPropertyTransformer';
import path = require('path');
import {emit} from './test_harness';

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
