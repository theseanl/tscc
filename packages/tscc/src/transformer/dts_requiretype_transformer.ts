/**
 * @fileoverview Transforms `const tsickle_aaaa = goog.requireType(.....)` calls to external modules
 * into const tsickle_aaaa = mangled$namespace$declared$in$externs. When certain external module's
 * main type declaration file merely reexports some other file,
 *
 * (details to be tested, some other file or some other file in another module?)
 *
 * tsickle inserts such requireType statements referencing that file directly.
 *
 * Type declarations in such files are already declared in externs, so we can just alias that variable
 * with a namespace on which the file's declarations are written.
 *
 * This code was mostly same as the one we've used to transform goog.require("a-external_module")
 * before we've switched to gluing module method.
 *
 * Codes are copied from commit
 * 1c9824461fcb71814466729b9c1424c4a60ef4ce (feat: use gluing modules for external module support)
 *
 * TODO: improve comment here and documentation.
 */
import * as ts from 'typescript';
import ITsccSpecWithTS from '../spec/ITsccSpecWithTS';
import {TsickleHost} from 'tsickle';
import {moduleNameAsIdentifier} from 'tsickle/out/src/annotator_host';
import {isGoogRequireLikeStatement, topLevelStatementTransformerFactory} from './transformer_utils';
import {escapedGoogNameIsDts, unescapeGoogAdmissibleName} from '../shared/escape_goog_identifier';
import path = require('path');

/**
 * This is a transformer run after ts transformation, before googmodule transformation.
 *
 * In order to wire imports of external modules to their global symbols, we replace
 * top-level `require`s of external modules to an assignment of a local variable to
 * a global symbol. This results in no `goog.require` or `goog.requireType` emit.
 */
export default function dtsRequireTypeTransformer(spec: ITsccSpecWithTS, tsickleHost: TsickleHost)
	: (context: ts.TransformationContext) => ts.Transformer<ts.SourceFile> {
	const externalModuleNames = spec.getExternalModuleNames();

	return topLevelStatementTransformerFactory((node, fh) => {
		let _ = isGoogRequireLikeStatement(node, "requireType");
		if (!_) return node;
		let {importedUrl, newIdent} = _;

		// We are only interested in `requireType`ing .d.ts files.
		if (!escapedGoogNameIsDts(importedUrl)) return node;
		// If imported url is external module, no need to handle it further.
		if (externalModuleNames.includes(importedUrl)) return node;
		// origUrl will be a file path relative to the ts project root.
		let origUrl = unescapeGoogAdmissibleName(importedUrl);
		let absoluteOrigUrl = path.resolve(spec.getTSRoot(), origUrl);
		// We must figure out on what namespace the extern for this module is defined.
		// See tsickle/src/externs.js for precise logic. In our case, goog.requireType(....d.ts)
		// will be emitted for "module .d.ts", in which case a mangled name derived from a
		// .d.ts file's path is used. See how `moduleNamespace`, `rootNamespace` is constructed
		// in tsickle/src/externs.js.
		// This relies on the heuristic of tsickle, so must be carefully validated whenever tsickle updates.
		let mangledNamespace = moduleNameAsIdentifier(tsickleHost, absoluteOrigUrl);
		if (newIdent.escapedText === mangledNamespace) {
			// Name of the introduced identifier coincides with the global identifier,
			// no need to emit things.
			return setOriginalNode(fh.factory.createEmptyStatement(), node);
		}
		// Convert `const importedName = goog.requireType("module d.ts")` to:
		// `const importedName = mangledNamespace;`
		return setOriginalNode(
			fh.createVariableAssignment(
				newIdent, fh.namespaceToQualifiedName(mangledNamespace), !tsickleHost.es5Mode
			),
			node
		);
	});
}

function setOriginalNode<T extends ts.Node>(range: T, node: ts.Statement): T {
	return ts.setOriginalNode<T>(ts.setTextRange(range, node), node);
}
