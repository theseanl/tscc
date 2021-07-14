/**
 * @fileoverview Provides a mixin for Rollup plugins that loads shim files for default libraries.
 * These are goog.goog and goog.reflect, which are always included if one is bundling with
 * @tscc/tscc.
 */
import {Plugin} from 'rollup';
import * as fs from 'fs';
import * as path from 'path';

const SHIM_ROOT = path.resolve(__dirname, "../third_party/closure_library");

const things = new Map([
	["goog:goog", fs.readFileSync(path.join(SHIM_ROOT, "goog_shim.js"), "utf8")],
	["goog:goog.reflect", fs.readFileSync(path.join(SHIM_ROOT, "reflect_shim.js"), "utf8")]
]);

// Rollup convention, see https://rollupjs.org/guide/en/#conventions
const PREFIX = "\0tscc\0";

export function googShimMixin(plugin: Plugin): Plugin {
	const {resolveId, load} = plugin;
	plugin.resolveId = function (id, importer) {
		if (things.has(id)) return PREFIX + id;
		return Reflect.apply(resolveId!, this, arguments);
	}
	plugin.load = function (id) {
		if (id.startsWith(PREFIX)) return things.get(id.substring(PREFIX.length));
		return Reflect.apply(load!, this, arguments);
	}
	return plugin;
}
