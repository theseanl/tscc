import * as ts from 'typescript';

/**
 * Returns the string argument if call is of the form
 * require('foo')
 */
export function extractRequire(call: ts.CallExpression): string | null {
	// Verify that the call is a call to require(...).
	if (call.expression.kind !== ts.SyntaxKind.Identifier) return null;
	const ident = call.expression as ts.Identifier;
	if (ident.escapedText !== 'require') return null;

	// Verify the call takes a single string argument and grab it.
	if (call.arguments.length !== 1) return null;
	const arg = call.arguments[0];
	if (arg.kind !== ts.SyntaxKind.StringLiteral) return null;
	return (arg as ts.StringLiteral).text;
}

export function isVariableRequireStatement(stmt: ts.Statement): {
	importedUrl: string,
	newIdent: ts.Identifier
} {
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

// Copied from tsickle
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


