/**
 * @fileoverview Hand-modified shim file for Closure Library `goog/reflect.js`. References to the
 * global `goog` variables have been removed.
 */

export function object(type, object) {
	return object;
}

export function objectProperty(prop, object) {
	return prop;
}

export function sinkValue(x) {
	sinkValue[' '](x);
	return x;
}
sinkValue[' '] = function () {};

export function canAccessProperty(obj, prop) {
	try {
		sinkValue(obj[prop]);
		return true;
	} catch (e) {}
	return false;
}

export function cache(cacheObj, key, valueFn, opt_keyFn) {
	const storedKey = opt_keyFn ? opt_keyFn(key) : key;

	if (Object.prototype.hasOwnProperty.call(cacheObj, storedKey)) {
		return cacheObj[storedKey];
	}

	return (cacheObj[storedKey] = valueFn(key));
};
