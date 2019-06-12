import { IModule } from './ITsccSpecJSON';

export interface INamedModuleSpecs extends IModule {
	moduleName: string
}
export interface INamedModuleSpecsWithId extends INamedModuleSpecs {
	moduleId: string
}
/**
 * All methods are expected to return absolute paths everywhere.
 * Relative paths in `tscc.spec.json` will be resolved relative to
 * the containing directory of the `tscc.spec.json`.
 */
export default interface ITsccSpec {
	resolveRollupExternalDeps(id: string): string
	/**
	 * It must respect prefix option of the spec.
	 */
	getOutputNameToEntryFileMap(): { [name: string]: string }
	/**
	 * If true, goog.modules are looked up in closure library, which are provided with
	 * the tscc module as a peerDependency. If one has to use user-provided closure library,
	 * they can add it to extraSources.
	 */
	shouldUseClosureDeps(): boolean
	/**
	 * Ordered module specs, so that no module is dependent on a module that appears earlier.
	 */
	getOrderedModuleSpecs(): INamedModuleSpecs[]
		/**
	 * Returns an array of external module names.
	 */
	getExternalModuleNames(): string[]
	/**
	 * Returns an object that maps external module names to its assumed global names.
	 */
	getExternalModuleNamesToGlobalsMap(): { [moduleName: string]: string }
	/**
	 * Returns a list of file names provided by the jsFiles key.
	 */
	getJsFiles():string[]
}
