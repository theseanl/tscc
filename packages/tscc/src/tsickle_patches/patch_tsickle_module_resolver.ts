/**
 * @fileoverview This patches tsickle's `resolveModuleName` function exported from `googmodule.ts`
 * in order to work around angular/tsickle#1039. {@link https://github.com/angular/tsickle/issues/1039}
 * Main goal is to make tsickle generates correct externs for lodash in that it does not cause Closure Compiler error.
 * In order to do so, we need to resolve relative paths in `declare module "../.."` to a file path.
 */
import * as ts from 'typescript';
import path = require('path');

/**
 * From an absolute file name, extract its containing folder in node_modules.
 * Maps
 * /.../my-package/node_modules/external-package/a/b/c/d.js
 * to /.../my-package/node_modules/external-package
 */
export function getPackageBoundary(fileName: string): string {
	let segments = path.normalize(fileName).split(path.sep);
	let i = segments.lastIndexOf("node_modules");
	let packageName = segments[i + 1];
	if (typeof packageName === 'string' && packageName.startsWith("@")) {
		/**
		 * Scoped packages, see
		 * {@link https://nodejs.org/api/modules.html#modules_all_together}, LOAD_PACKAGE_EXPORTS
		 */
		i++;
	}
	let moduleDir = segments.slice(0, i + 2).join(path.sep);
	return moduleDir + path.sep; // Note that this becomes '/' when node_modules is not found.
}

function resolveModuleName(
	host: {
		options: ts.CompilerOptions,
		moduleResolutionHost: ts.ModuleResolutionHost
	},
	pathOfImportingFile: string,
	imported: string
): string {
	const resolved = ts.resolveModuleName(
		imported,
		pathOfImportingFile,
		host.options,
		host.moduleResolutionHost
	);
	if (!resolved || !resolved.resolvedModule) {
		return imported;
	}
	const resolvedModule = resolved.resolvedModule.resolvedFileName;
	// check if resolvedModule pierces node_modules package boundary of pathOfImportingFile
	const importingFileBoundary = getPackageBoundary(pathOfImportingFile);
	const resolvedFileBoundary = getPackageBoundary(resolvedModule);
	if (importingFileBoundary !== resolvedFileBoundary) {
		// Do not resolve it, "must specially be handled by loaders anyway"
		return imported;
	}
	return resolvedModule;
}

let original: typeof import('tsickle/src/googmodule').resolveModuleName | undefined;
export function patchTsickleResolveModule() {
	if (!original) {
		const googmodule: typeof import('tsickle/src/googmodule') = require('tsickle/src/googmodule');
		original = googmodule.resolveModuleName;
		googmodule.resolveModuleName = resolveModuleName;
	}
}

export function restoreTsickleResolveModule() {
	if (original) {
		require('tsickle/src/googmodule').resolveModuleName = original;
		original = undefined;
	}
}
