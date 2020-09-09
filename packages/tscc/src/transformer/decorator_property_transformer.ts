/**
 * @fileoverview Decorators in TS is not compatible with Closure Compiler, as it generates
 * code that access a class' prototype property by string literals.
 * decoratorPropertyTransformer lookup occurence of such string literal property names,
 * and replaces it with appropriate `goog.reflect.objectProperty(<prop_name>, <target>)` call.
 *
 * Tsickle may at some point implement a similar feature. Currently it only implements some
 * other kinds of tranformation that is only made to make Angular work.
 *
 * Usage of goog.reflect.objectProperty is based on the following article:
 * {@link http://closuretools.blogspot.com/2016/06/using-polymer-with-closure-compiler-part-2.html}.
 *
 * In addition, we have to prevent this DevirtualizeMethods pass of closure compiler. However, there is
 * seem to be no stable way; see
 * nocollapse does not work - {@link https://github.com/google/closure-compiler/issues/2420}
 * sinkValue prevents inlining but does not prevent devirtualization
 * {@link https://github.com/google/closure-compiler/issues/2599}
 *
 * The pass is prevented when the property is accessed in a global scope, so we are creating
 * aaccesses of those and remove those via regex replace after the compilation. This is hacky and
 * not guaranteed to work but was the only way to make this work. Also has to be careful about
 * accessor decorators.
 */
import * as ts from 'typescript';
import {TsickleHost} from 'tsickle';
import TsHelperTransformer from './ts_helper_transformer';

export default function decoratorPropertyTransformer(tsickleHost: TsickleHost):
	(context: ts.TransformationContext) => ts.Transformer<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		return (sf: ts.SourceFile) => {
			return new DecoratorTransformer(tsickleHost, context, sf).transformSourceFile();
		};
	};
}

class DecoratorTransformer extends TsHelperTransformer {
	protected HELPER_NAME = "__decorate";

	private tempGlobalAssignments: ts.Statement[] = [];
	private getId() {
		return `tscc_global_access_name_${this.counter++}`;
	}
	private counter = 1;

	protected onHelperCall(node: ts.CallExpression, googReflectImport:ts.Identifier) {
		// Found a candidate. Decorator helper call signature:
		// __decorate([decoratorsArray], <target>, <propertyName>, <desc>)
		// Note that class decorator only has 2 arguments.
		let propNameLiteral = node.arguments[2];
		if (!propNameLiteral || !ts.isStringLiteral(propNameLiteral)) return;
		let propName = propNameLiteral.text;

		// Create goog.reflect.objectProperty
		const target = node.arguments[1];
		const googReflectObjectProperty = ts.setTextRange(
			ts.createCall(
				ts.createPropertyAccess(
					googReflectImport,
					ts.createIdentifier('objectProperty')
				),
				undefined,
				[
					ts.createStringLiteral(propName),
					ts.getMutableClone(target)
				]
			),
			propNameLiteral
		);
		// Replace third argument of __decorate call to goog.reflect.objectProperty.
		// If TS output is in ES3 mode, there will be 3 arguments in __decorate call.
		// if its higher than or equal to ES5 mode, there will be 4 arguments.
		// The number of arguments must be preserved.
		const caller = node.expression;
		const decorateArgs = node.arguments.slice();
		decorateArgs.splice(2, 1, googReflectObjectProperty);
		const newCallExpression = ts.createCall(caller, undefined, decorateArgs);
		const globalAssignment = ts.createBinary(
			ts.createElementAccess(
				ts.createIdentifier("self"),
				ts.createStringLiteral(this.getId())
			),
			ts.createToken(ts.SyntaxKind.FirstAssignment),
			ts.createPropertyAccess(
				ts.createParen(ts.getMutableClone(target)),
				ts.createIdentifier(propName)
			)
		);
		this.tempGlobalAssignments.push(
			ts.setEmitFlags(
				ts.createExpressionStatement(globalAssignment),
				ts.EmitFlags.NoSourceMap | ts.EmitFlags.NoTokenSourceMaps | ts.EmitFlags.NoNestedSourceMaps
			)
		);
		return newCallExpression;
	}

	protected combineStatements(stmts:ts.Statement[], googReflectImport:ts.Identifier) {
		super.combineStatements(stmts, googReflectImport);
		stmts.push(
			ts.createExpressionStatement(ts.createStringLiteral("__tscc_export_start__")),
			ts.createBlock(this.tempGlobalAssignments),
			ts.createExpressionStatement(ts.createStringLiteral('__tscc_export_end__'))
		);
		return stmts;
	}
}
