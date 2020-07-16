/**
 * @fileoverview This contains functions to apply various patches to tsickle. For more details, see
 * each modules. This must be applied and restored synchronously before and after tsickle runs.
 */

import {patchTsickleResolveModule, restoreTsickleResolveModule} from './patch_tsickle_module_resolver';
import {patchTsickleDecoratorTransformer, restoreTsickleDecoratorTransformer} from './patch_tsickle_decorator_transformer';

export function applyPatches() {
	patchTsickleResolveModule();
	patchTsickleDecoratorTransformer();
}

export function restorePatches() {
	restoreTsickleResolveModule();
	restoreTsickleDecoratorTransformer();
}
