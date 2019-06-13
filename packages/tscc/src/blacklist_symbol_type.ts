/**
 * @fileoverview This module enables blacklisting types based on symbol's name.
 * Tsickle's API only provide a way to blacklist certain types by their originating file's name.
 * We need this to prevent tsickle to emit `goog.requireType` for external modules, where
 * `TypeTranslator#isBlacklisted` is called on the string literal indicating the module's name.
 * In order to achieve this, here we override the method `TypeTranslator#isBlacklisted`. Since
 * this is not a public API, one should check this with every version change of tsickle.
 */
import * as ts from 'typescript';


const blacklistedSymbolNames: Set<string> = new Set();

export function registerTypeBlacklistedModuleName(moduleName: string) {
	// Typescript double-quotes internally the string literal representing module names.
	blacklistedSymbolNames.add('"' + moduleName + '"');
}

function symbolIsBlacklisted(symbol: ts.Symbol): boolean {
	return blacklistedSymbolNames.has(symbol.name);
}

let hasOverridden = false;

export function patchTypeTranslator() {
	if (hasOverridden) return;
	hasOverridden = true;

	// Patching `isBlacklisted` exported function in "type_translator.ts"
	// and a method `TypeTranslator#isBlacklisted` that references it locally.

	const typeTranslator: typeof import('tsickle/src/type_translator')
		= require('tsickle/src/type_translator');

	const __isBlacklisted = typeTranslator.isBlacklisted;
	typeTranslator.isBlacklisted = function (_: Set<string> | undefined, symbol: ts.Symbol) {
		if (symbolIsBlacklisted(symbol)) return true;
		return Reflect.apply(__isBlacklisted, this, arguments);
	}

	const TypeTranslator = typeTranslator.TypeTranslator;
	const __TypeTranslator_isBlackListed = TypeTranslator.prototype.isBlackListed;
	TypeTranslator.prototype.isBlackListed = function (symbol: ts.Symbol): boolean {
		if (symbolIsBlacklisted(symbol)) return true;
		return Reflect.apply(__TypeTranslator_isBlackListed, this, arguments);
	}
}

