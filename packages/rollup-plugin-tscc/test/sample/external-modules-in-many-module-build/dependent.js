import {common} from './common/index';
import {entry} from './entry';
import * as b from './external-dependent';
common(3);
entry();
console.log(b);
