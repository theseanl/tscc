import {IModule, INamedModuleSpecs} from './ITsccSpecJSON';

export interface INamedModuleSpecsWithId extends INamedModuleSpecs {
	moduleId: string
}

/**
 * All methods are expected to return absolute paths everywhere.
 * Relative paths in `tscc.spec.json` will be resolved relative to
 * the containing directory of the `tscc.spec.json`.
 */
export default interface ITsccSpec {
	getOrderedModuleSpecs():INamedModuleSpecs[]
	/**
	 * Returns an array of external module names.
	 */
	getExternalModuleNames(): string[]
	/**
	 * Returns an object that maps external module names to its assumed global names.
	 */
	getExternalModuleNamesToGlobalsMap(): {[moduleName: string]: string}
	/**
	 * Returns a list of file names provided by the jsFiles key.
	 */
	getJsFiles(): string[]
}
