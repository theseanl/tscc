import ITsccSpec from '@tscc/tscc-spec/src/ITsccSpec';
import * as ts from 'typescript'

export default interface ITsccSpecWithTS extends ITsccSpec {
	getCompilerOptions():Readonly<ts.CompilerOptions>
	getCompilerHost():ts.CompilerHost
	getOutputFileNames():string[]
	/**
	 * --compilation_level: defaults to ADVANCED
	 * --language_in: Derived from tsconfig's `target`
	 * --language_out: defaults to ECMASCRIPT5
	 * --chunk_output_prefix: determined from `prefix` key of tscc spec.
	 */
	getBaseCompilerFlags():string[]
	/**
	 * Returns a list of file names included in the TS project.
	 */
	getAbsoluteFileNamesSet():Set<string>
	/**
	 * For a given module name as used in import ... from ${moduleName}, returns a type reference file's
	 * file name. Returns null if it cannot find a type definition for a module's name.
	 */
	resolveExternalModuleTypeReference(moduleName:string):string;
	/**
	 * Create a unique hash for a project, consisting of the absolute path of tsconfig,
	 * absolute path of tsccspec, and their contents.
	 */
	getProjectHash(): string
	/**
	 * Whether or not to write intermediate tsickle output to temp directory (for debugging)
	 */
	isDebug(): boolean

}
