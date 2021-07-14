///<reference path="../../../../third_party/closure_library/base.d.ts"/>
import * as goog from 'goog:goog';

export function isDebugging() {
	return goog.DEBUG;
}

if (isDebugging()) {
	console.log("Debugging");
}
