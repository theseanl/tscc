import * as entry from './entry';

import * as goog from 'goog:goog';

// This module is only used in "dependent" module, so the corresponding shim file's content should
// only be included in the "dependent" chunk.
import * as googReflect from 'goog:goog.reflect';

var dictionary = {
	"key": "value"
};

if (entry.isDebugging() && goog.global.name === googReflect.objectProperty("key", dictionary)) {
	console.log(dictionary[goog.global.name]);
};
