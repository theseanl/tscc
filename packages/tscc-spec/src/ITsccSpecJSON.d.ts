/**
 * @fileoverview All paths in values are resolved from the parent directory of the JSON file.
 */
export declare interface IModule {
    /**
     * The entry file of the module.
     */
    entry: string;
    /**
     * An array of module names, which the current module depends on.
     */
    dependencies?: ReadonlyArray<string>;
    /**
     * An array of file paths, which may not be reachable via `goog.require`s but
     * still need to be provided to the closure compiler.
     */
    extraSources?: ReadonlyArray<string>;
}
export interface INamedModuleSpecs extends IModule {
    /**
     * The name of this module, to be used as the name of the output file, and to
     * refer modules in IModules.dependencies key.
     */
    moduleName: string;
}
export declare interface IStyles {
    /**
     * A list of file paths, which will be compiled to a single css file.
     */
    src: ReadonlyArray<string>;
    /**
     * A prefix that will be prepended to renamed class names.
     */
    prefix?: string;
    /**
     * A list of module names in which the renaming map will be injected.
     */
    modules?: ReadonlyArray<string>;
}
declare interface ITsccSpecJSON {
    modules: {
        /**
         * moduleName is a name of the module, to be used as the name of the output file,
         * and to refer modules in IModule.dependencies key.
         * It supports path delimiters.
         */
        readonly [moduleName: string]: string | Readonly<IModule>;
    } | 
    /**
     * Or alternatively, provide then in a custom order with module's name as a key as well,
     * it must be topologically sorted
     */
    INamedModuleSpecs[];
    /**
     * Similar to rollup's input option "external", maps module IDs to global names that's assumed
     * to be present in the global scope. Type declaration files must be available in the respective
     * npm modules or one must provide them manually with `declare module "moduleName" { }` statements.
     */
    external?: {
        readonly [moduleName: string]: string;
    };
    /**
     * Glob of js source files.
     */
    jsFiles?: string[];
    /**
     * Directory names to emit outputs in, or prefixes for output file names.
     * It will just be prepended to module names.
     */
    prefix?: string | {
        readonly rollup: string;
        readonly cc: string;
    };
    /**
     * If set as true, the bundler will enable loading and bundling of closure libraries
     * Otherwise, statements like `import * from "goog:array"` won't work.
     * This is a shortcut, meant to avoid creating dependency graph of closure libraries
     * every time. TODO cache dependency graph for consumer's project.
     */
    closureLibrary: boolean;
    /**
     * Compiler flags to be passed to closure compiler. Tscc treats it as an opaque data.
     * "js", "chunk", "entry_point": computed from <modules>
     * "chunk_output_path_prefix": computed from <prefix>
     * "language_in": computed from "compilerOption.target" of tsconfig
     * "language_out:; defaults to "ECMASCRIPT5".
     * "compilation_level": defaults to "ADVANCED".
     * Input files, output files, input language, and so on are inferred from other settings,
     * and if provided here, it will override the inferred values.
     */
    compilerFlags?: {
        [flag: string]: primitives | primitives[];
    };
    /**
     * Array of paths of soy files.
     */
    templates?: ReadonlyArray<string>;
    styles?: {
        /**
         * A file path of the output css. It supports path delimiters.
         */
        [styleName: string]: Readonly<IStyles>;
    };
    debug?: boolean;
}
declare type primitives = string | boolean | number;
export default ITsccSpecJSON;
