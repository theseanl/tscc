/**
 * @fileoverview Transforms `import localName from "external_module"` to
 * `const localName = global_name_for_the_external_module`.
 * Also transforms `import tslib_any from 'tslib'` to `goog.require("tslib")`.
 */

import * as ts from 'typescript';
import ITsccSpecWithTS from '../spec/ITsccSpecWithTS';
import {TsickleHost} from 'tsickle';
import {moduleNameAsIdentifier} from 'tsickle/src/annotator_host';
import {isVariableRequireStatement} from './transformer_utils';

// Copied from tsickle
/** Creates a call expression corresponding to `goog.${methodName}(${literal})`. */
function createGoogCall(methodName: string, literal: ts.StringLiteral): ts.CallExpression {
	return ts.createCall(
		ts.createPropertyAccess(ts.createIdentifier('goog'), methodName), undefined, [literal]
	);
}
function createSingleQuoteStringLiteral(text: string): ts.StringLiteral {
	const stringLiteral = ts.createLiteral(text);
	(stringLiteral as any).singleQuote = true;
	return stringLiteral;
}

function namespaceToQualifiedName(namespace: string): ts.Expression {
	let names = namespace.split('.');
	let l = names.length;
	let qualifiedName: ts.Expression = ts.createIdentifier(names[0]);
	for (let i = 1; i < l; i++) {
		qualifiedName = ts.createPropertyAccess(qualifiedName, ts.createIdentifier(names[i]));
	}
	return qualifiedName;
}

/**
 * This is a transformer run after ts transformation, before googmodule transformation.
 * In order to wire imports of external modules to their global symbols, we replace
 * top-level `require`s of external modules to an assignment of a local variable to 
 * a global symbol. This results in no `goog.require` or `goog.requireType` emit.
 */
export default function externalModuleTransformer(spec: ITsccSpecWithTS, tsickleHost: TsickleHost, typeChecker: ts.TypeChecker)
	: (context: ts.TransformationContext) => ts.Transformer<ts.SourceFile> {
	return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
		/**
		 * Transforms expressions accessing "default" property of a global variable of
		 * external modules to the global variable itself.
		 * Most libraries' esm version exposes its main object as its default export, 
		 * whereas exposing itself as a global object in browser versions, and TS transforms
		 * references to such a local imported variable to an access to `.default` property.
		 * This transformation won't touch user-written `.default` access.
		 */
		// Copied from tsickle
		const previousOnSubstituteNode = context.onSubstituteNode;
		context.enableSubstitution(ts.SyntaxKind.PropertyAccessExpression);
		context.onSubstituteNode = (hint, node: ts.Node): ts.Node => {
			node = previousOnSubstituteNode(hint, node);
			if (!ts.isPropertyAccessExpression(node)) return node;
			if (node.name.text !== 'default') return node;
			if (!ts.isIdentifier(node.expression)) return node;
			// Find the import declaration this node comes from.
			// This may be the original node, if the identifier was transformed from it.
			const orig = ts.getOriginalNode(node.expression);
			let importExportDecl: ts.ImportDeclaration | ts.ExportDeclaration;
			if (ts.isImportDeclaration(orig) || ts.isExportDeclaration(orig)) {
				importExportDecl = orig;
			} else {
				// Alternatively, we can try to find the declaration of the symbol. This only works for
				// user-written .default accesses, the generated ones do not have a symbol associated as
				// they are only produced in the CommonJS transformation, after type checking.
				const sym = typeChecker.getSymbolAtLocation(node.expression);
				if (!sym) return node;
				const decls = sym.getDeclarations();
				if (!decls || !decls.length) return node;
				const decl = decls[0];
				if (decl.parent && decl.parent.parent && ts.isImportDeclaration(decl.parent.parent)) {
					importExportDecl = decl.parent.parent;
				} else {
					return node;
				}
			}
			// copied from tsickle end 

			// If it was an import from registered external modules, remove `.default`.
			let importUrl = (importExportDecl.moduleSpecifier as ts.StringLiteral).text;
			if (spec.getExternalModuleNames().includes(importUrl)) {
				return node.expression;
			}
			return node;
		};

		return (sf: ts.SourceFile): ts.SourceFile => {
			function maybeExternalModuleRequire(
				original: ts.Statement, importedUrl: string, newIdent: ts.Identifier
			) {
				const setOriginalNode = (range: ts.Statement) => {
					return ts.setOriginalNode(ts.setTextRange(range, original), original);
				}
				// require('tslib') requires special treatment - map it to goog.require('tslib')
				if (importedUrl === 'tslib') {
					let varDecl = ts.createVariableDeclaration(
						newIdent, undefined, createGoogCall('require', createSingleQuoteStringLiteral('tslib'))
					);
					return setOriginalNode(ts.createVariableStatement(
						undefined, ts.createVariableDeclarationList(
							[varDecl], tsickleHost.es5Mode ? undefined : ts.NodeFlags.Const
						)
					))
				}
				const globalName = spec.getExternalModuleNamesToGlobalsMap()[importedUrl];
				if (typeof globalName === 'undefined') return null;
				// We must figure out on what namespace the extern for this module is defined.
				// If it was from `declare module "..."` in a user-provided file, it comes from 'getIdentifierText'
				// If it was from exported declaration file found in node_modules, 
				// it is  converted from some$path$like$this which is derived from moduleNameAsIdentifier function.
				// This relies on the heuristic of tsickle, so must be carefully validated whenever tsickle updates.
				if (newIdent.escapedText === globalName) {
					// Name of the introduced identifier coincides with the global identifier,
					// no need to emit things.
					return setOriginalNode(ts.createEmptyStatement());
				}
				// Convert `const importedName = require('externalModuleName')` to:
				// `const importedName = GlobalName;`
				return setOriginalNode(ts.createVariableStatement(
					undefined,
					ts.createVariableDeclarationList(
						[
							ts.createVariableDeclaration(
								newIdent,
								undefined,
								namespaceToQualifiedName(globalName)
							)
						],
						tsickleHost.es5Mode ? undefined : ts.NodeFlags.Const)
				));
			}

			function visitTopLevelStatement(statements: ts.Statement[], sf: ts.SourceFile, node: ts.Statement) {
				lookupExternalModuleRequire: {
					let _ = isVariableRequireStatement(node);
					if (!_) break lookupExternalModuleRequire;
					let {importedUrl, newIdent} = _;
					const require = maybeExternalModuleRequire(node, importedUrl, newIdent);
					if (!require) break lookupExternalModuleRequire;
					statements.push(require);
					return;
				}
				statements.push(node);
			}

			const stmts: ts.Statement[] = [];
			for (const stmt of sf.statements) visitTopLevelStatement(stmts, sf, stmt);
			return ts.updateSourceFileNode(sf, ts.setTextRange(ts.createNodeArray(stmts), sf.statements));
		}
	}
}

export function getExternsForExternalModules(tsccSpec: ITsccSpecWithTS, tsickleHost: TsickleHost): string {
	const moduleNames = tsccSpec.getExternalModuleNames();
	const toGlobalName = tsccSpec.getExternalModuleNamesToGlobalsMap();
	const header = `\n/** Generated by TSCC */\n`
	let out = '';
	for (let moduleName of moduleNames) {
		// If a module's type definition is from node_modules, its path is used as a namespace.
		// otherwise, it comes from declare module '...' in user-provided files, in which the module name string
		// is used as a namespace.
		let typeRefFile = tsccSpec.resolveExternalModuleTypeReference(moduleName) || moduleName;
		out += `/** @type{${moduleNameAsIdentifier(tsickleHost, typeRefFile)}} */
${tsickleHost.es5Mode ? 'var' : 'const'} ${toGlobalName[moduleName]} = {};\n`;
	}
	if (out.length) return header + out;
}

