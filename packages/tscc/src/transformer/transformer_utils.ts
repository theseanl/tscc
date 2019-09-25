import * as ts from 'typescript';

/**
 * Returns the string argument if call is of the form
 * require('foo')
 */
function extractRequire(call: ts.CallExpression): string | null {
	// Verify that the call is a call of a form require(...).
	const ident = call.expression;
	if (!ts.isIdentifier(ident)) return null;
	if (ident.escapedText !== 'require') return null;

	return getRequiredModuleName(call);
}

function extractGoogRequire(call: ts.CallExpression): string | null {
	// Verify that the call is a call of a form goog.require(...).
	let exp = call.expression;
	if (!ts.isPropertyAccessExpression(exp)) return null;
	if (!ts.isIdentifier(exp.expression) || exp.expression.escapedText !== 'goog') return null;
	if (exp.name.escapedText !== 'require') return null;

	return getRequiredModuleName(call);
}

function getRequiredModuleName(call: ts.CallExpression): string | null {
	if (call.arguments.length !== 1) return null;

	// Verify the call takes a single string argument and grab it.
	const arg = call.arguments[0];
	if (!ts.isStringLiteral(arg)) return null;
	return arg.text;
}

interface IImportedVariable {
	importedUrl: string,
	newIdent: ts.Identifier
}

function isVariableRequireStatement(stmt: ts.Statement): IImportedVariable {
	if (!ts.isVariableStatement(stmt)) return;
	// Verify it's a single decl (and not "var x = ..., y = ...;").
	if (stmt.declarationList.declarations.length !== 1) return;
	const decl = stmt.declarationList.declarations[0];

	// Grab the variable name (avoiding things like destructuring binds).
	if (decl.name.kind !== ts.SyntaxKind.Identifier) return;
	if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
		return;
	}
	const importedUrl = extractRequire(decl.initializer);
	if (!importedUrl) return;
	return {importedUrl, newIdent: decl.name};
}

function isGoogRequireStatement(stmt: ts.Statement): IImportedVariable {
	if (!ts.isVariableStatement(stmt)) return;
	// Verify it's a single decl (and not "var x = ..., y = ...;").
	if (stmt.declarationList.declarations.length !== 1) return;
	const decl = stmt.declarationList.declarations[0];

	// Grab the variable name (avoiding things like destructuring binds).
	if (decl.name.kind !== ts.SyntaxKind.Identifier) return;
	if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
		return;
	}
	const importedUrl = extractGoogRequire(decl.initializer);
	if (!importedUrl) return;
	return {importedUrl, newIdent: decl.name};
}

export function findImportedVariable(sf: ts.SourceFile, moduleName: string): ts.Identifier {
	for (let stmt of sf.statements) {
		let _ = isVariableRequireStatement(stmt);
		if (!_) continue;
		if (_.importedUrl !== moduleName) continue;
		return _.newIdent
	}
}

export function findGoogRequiredVariable(sf: ts.SourceFile, moduleName: string): ts.Identifier {
	for (let stmt of sf.statements) {
		let _ = isGoogRequireStatement(stmt);
		if (!_) continue;
		if (_.importedUrl !== moduleName) continue;
		return _.newIdent;
	}
}


/**
 * The transformer needs to discern "tslib" function calls (called EmitHelpers in TS),
 * but they are simply identifiers of name `__decorate` and such, all the difference
 * lies in their `emitNode` internal property. Any functionality related to this is
 * under internal and is not available in public API.
 * This function currently access Node.emitNode.flags to achieve this
 */
export function identifierIsEmitHelper(ident: ts.Identifier): boolean {
	let emitNode = ident["emitNode"];
	if (emitNode === undefined) return false;
	let flags = emitNode["flags"];
	if (typeof flags !== "number") return false;
	return (flags & ts.EmitFlags.HelperName) !== 0;
}

/**
 * Codes below this line in this file are content of tsickle source files, available at
 * {@link https://github.com/angular/tsickle/blob/e873704a48760f2911bf484a1b4e389d3a1805f3/src/transformer_util.ts}
 *
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Creates a call expression corresponding to `goog.${methodName}(${literal})`. */
export function createGoogCall(methodName: string, literal: ts.StringLiteral): ts.CallExpression {
	return ts.createCall(
		ts.createPropertyAccess(ts.createIdentifier('goog'), methodName), undefined, [literal]
	);
}
export function createSingleQuoteStringLiteral(text: string): ts.StringLiteral {
	const stringLiteral = ts.createLiteral(text);
	(stringLiteral as any).singleQuote = true;
	return stringLiteral;
}


export function namespaceToQualifiedName(namespace: string): ts.Expression {
	let names = namespace.split('.');
	let l = names.length;
	let qualifiedName: ts.Expression = ts.createIdentifier(names[0]);
	for (let i = 1; i < l; i++) {
		qualifiedName = ts.createPropertyAccess(qualifiedName, ts.createIdentifier(names[i]));
	}
	return qualifiedName;
}

