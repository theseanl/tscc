/**
 * @fileoverview Hand-modified shim file for Closure Library `goog/goog.js`. References to the
 * global `goog` variables have been removed.
 */
export const global = this || self; // Use rollup "context" option to prevent `this` rewrite

export function define(name, value) {
	var uncompiledDefines = global.CLOSURE_UNCOMPILED_DEFINES;
	var defines = global.CLOSURE_DEFINES;
	if (uncompiledDefines) value = uncompiledDefines[name];
	else if (defines) value = defines[name];
	return value;
}

export let DEBUG = true;

export function typeOf(value) {
	var s = typeof value;
	if (s != 'object') return s;
	if (!value) return 'null';
	if (Array.isArray(value)) return 'array';
	return s;
};
export function isArrayLike(val) {
	var type = typeOf(val);
	return type == 'array' || type == 'object' && typeof val.length == 'number';
}
export function isObject(val) {
	var type = typeof val;
	return type == 'object' && val != null || type == 'function';
}
export function getCssName(className, opt_modifier) {
	return className;
}
export function getMsg(str, opt_values, opt_options) {
	if (opt_options && opt_options.html) {
		// Note that '&' is not replaced because the translation can contain HTML
		// entities.
		str = str.replace(/</g, '&lt;');
	}
	if (opt_options && opt_options.unescapeHtmlEntities) {
		// Note that "&amp;" must be the last to avoid "creating" new entities.
		str = str.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&apos;/g, '\'')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&');
	}
	if (opt_values) {
		str = str.replace(/\{\$([^}]+)}/g, function (match, key) {
			return (opt_values != null && key in opt_values) ? opt_values[key] :
				match;
		});
	}
	return str;
}
export function exportSymbol(publicPath, object, objectToExportTo) {
	var parts = publicPath.split('.');
	var cur = objectToExportTo || global;
	for (var part; parts.length && (part = parts.shift());) {
		if (!parts.length && object !== undefined) {
			cur[part] = object;
		} else if (cur[part] && cur[part] !== Object.prototype[part]) {
			cur = cur[part];
		} else {
			cur = cur[part] = {};
		}
	}
}
export function exportProperty(object, publicName, symbol) {
	object[publicName] = symbol;
}
