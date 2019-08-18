/**
 * @fileoverview Files described here are provided to closure compiler by default.
 */
import fs = require('fs');
import path = require('path');
import resolve = require('resolve-from');

// Resolves file path relative to tscc package root. Prefers that in node_modules directory
// of the caller. (Such file paths might be included in sourcemaps if user have it enabled,
// so if it uses files in the global npm/yarn installation directory, it may expose file structure
// of the build machine.)
// TODO consider providing a dummy path. 
function resolveTSCCAssets(relPath: string, projectRoot: string): string {
	// Below returns `null` when the package is not found.
	const packageRoot = resolve.silent(projectRoot, `@tscc/tscc/package.json`);
	if (packageRoot) {
		const resolved = path.resolve(packageRoot, '..', relPath);
		if (fs.existsSync(resolved)) return resolved;
	}
	return path.resolve(__dirname, '..', relPath);
}

const tsLibDir = 'third_party/tsickle/third_party/tslib';
const tsLibPath = path.join(tsLibDir, 'tslib.js');
const tslibExternsPath = path.join(tsLibDir, 'externs.js');

const closureLibDir = 'third_party/closure_library';
const googBasePath = path.join(closureLibDir, 'base.js');
const googReflectPath = path.join(closureLibDir, 'reflect.js');

export default function (projectRoot: string) {
	const libs = [
		{id: "tslib", path: resolveTSCCAssets(tsLibPath, projectRoot)},
		{id: "goog", path: resolveTSCCAssets(googBasePath, projectRoot)},
		{id: "goog.reflect", path: resolveTSCCAssets(googReflectPath, projectRoot)}
	];
	const externs = [
		resolveTSCCAssets(tslibExternsPath, projectRoot)
	]
	return {libs, externs};
}

