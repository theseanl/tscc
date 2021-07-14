import {isVariableRequireStatement, isGoogRequireLikeStatement, topLevelStatementTransformerFactory} from './transformer_utils';

export const googNamespaceTransformer = topLevelStatementTransformerFactory((stmt, fh) => {
	// Before googmodule transformer of tsickle, import statements we are looking for looks like
	// var goog = require('goog:goog').
	let _ = isVariableRequireStatement(stmt);
	if (_) {
		let {importedUrl, newIdent} = _;
		if (importedUrl === "goog:goog" && newIdent.text === "goog") {
			return fh.factory.createNotEmittedStatement(stmt);
		}
	} else {
		_ = isGoogRequireLikeStatement(stmt, "requireType");
		if (_) {
			let {importedUrl, newIdent} = _;
			if (importedUrl === "goog") {
				return fh.createVariableAssignment(newIdent, fh.factory.createIdentifier("goog"));
			}
		}
	}
});
