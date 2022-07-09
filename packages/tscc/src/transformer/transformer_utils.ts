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

type TGoogRequireLike = "require" | "requireType";

/**
 * Verify that the call is a call of a form goog.require(...).
 * @param requireLike require, requireType, provides, ...
 */
function extractGoogRequireLike(call: ts.CallExpression, requireLike: TGoogRequireLike): string | null {
	let exp = call.expression;
	if (!ts.isPropertyAccessExpression(exp)) return null;
	if (!ts.isIdentifier(exp.expression) || exp.expression.escapedText !== 'goog') return null;
	if (exp.name.escapedText !== requireLike) return null;

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

export function isVariableRequireStatement(stmt: ts.Statement): IImportedVariable | undefined {
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

export function isGoogRequireLikeStatement(stmt: ts.Statement, requireLike: TGoogRequireLike): IImportedVariable | undefined {
	if (!ts.isVariableStatement(stmt)) return;
	// Verify it's a single decl (and not "var x = ..., y = ...;").
	if (stmt.declarationList.declarations.length !== 1) return;
	const decl = stmt.declarationList.declarations[0];

	// Grab the variable name (avoiding things like destructuring binds).
	if (decl.name.kind !== ts.SyntaxKind.Identifier) return;
	if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
		return;
	}
	const importedUrl = extractGoogRequireLike(decl.initializer, requireLike);
	if (!importedUrl) return;
	return {importedUrl, newIdent: decl.name};
}

export function findImportedVariable(sf: ts.SourceFile, moduleName: string): ts.Identifier | undefined {
	for (let stmt of sf.statements) {
		let _ = isVariableRequireStatement(stmt);
		if (!_) continue;
		if (_.importedUrl !== moduleName) continue;
		return _.newIdent
	}
}

export function findGoogRequiredVariable(sf: ts.SourceFile, moduleName: string): ts.Identifier | undefined {
	for (let stmt of sf.statements) {
		let _ = isGoogRequireLikeStatement(stmt, "require");
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
	let emitNode = (ident as any)["emitNode"];
	if (emitNode === undefined) return false;
	let flags = emitNode["flags"];
	if (typeof flags !== "number") return false;
	return (flags & ts.EmitFlags.HelperName) !== 0;
}

/**
 * A helper class that provides methods related to TS node factory functions. In body of TS
 * transformers, TS recommends to use ts.Factory object available as a property of a transformer
 * context object.
 */
export class NodeFactoryHelper {
	constructor(
		public readonly factory: ts.NodeFactory
	) {}
	/** Creates a call expression corresponding to `goog.${methodName}(${literal})`. */
	createGoogCall(methodName: string, literal: ts.StringLiteral): ts.CallExpression {
		return this.factory.createCallExpression(
			this.factory.createPropertyAccessExpression(
				this.factory.createIdentifier('goog'), methodName
			),
			undefined,
			[literal]
		);
	}
	// Creates a variable assignment var ${newIdent} = ${initializer}. Set constant = true to have
	// const instead of var.
	createVariableAssignment(newIdent: ts.Identifier, initializer: ts.Expression, useConst: boolean = false) {
		return this.factory.createVariableStatement(
			undefined,
			this.factory.createVariableDeclarationList(
				[
					this.factory.createVariableDeclaration(
						newIdent,
						undefined,
						undefined,
						initializer
					)
				],
				useConst ? ts.NodeFlags.Const : undefined
			)
		)
	}
	createSingleQuoteStringLiteral(text: string): ts.StringLiteral {
		const stringLiteral = this.factory.createStringLiteral(text);
		(stringLiteral as any)['singleQuote'] = true;
		return stringLiteral;
	}
	namespaceToQualifiedName(namespace: string): ts.Expression {
		let names = namespace.split('.');
		let l = names.length;
		let qualifiedName: ts.Expression = this.factory.createIdentifier(names[0]);
		for (let i = 1; i < l; i++) {
			qualifiedName = this.factory.createPropertyAccessExpression(
				qualifiedName, this.factory.createIdentifier(names[i])
			);
		}
		return qualifiedName;
	}
}

/**
 * A factory function that produces ts.TransformerFactory which iterates over a ts.SourceFile's
 * statements and replacing it if needed.
 */
export function topLevelStatementTransformerFactory(
	transformStatement: (stmt: ts.Statement, fh: NodeFactoryHelper) => ts.Statement | void
): ts.TransformerFactory<ts.SourceFile> {
	return (context) => {
		const factoryHelper = new NodeFactoryHelper(context.factory);
		return (sf) => {
			const stmts: ts.Statement[] = [];
			for (const stmt of sf.statements) {
				let newStmt = transformStatement(stmt, factoryHelper);
				stmts.push((newStmt ?? stmt) as ts.Statement);
			}
			return context.factory.updateSourceFile(
				sf,
				ts.setTextRange(
					context.factory.createNodeArray(stmts),
					sf.statements
				)
			);
		}
	}
}
