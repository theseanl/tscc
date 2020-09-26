import {common} from './common/index';
import * as a from './external-entry';

export function entry() {
	common(0);
	console.log("entry");
}

entry();
console.log(a);
