import {IInputTsccSpecJSON, ITsccSpecJSON, primitives, TsccSpec, TsccSpecError} from '@tscc/tscc-spec';
import * as ts from 'typescript';
import ITsccSpecWithTS from './ITsccSpecWithTS';
import path = require('path');

export class TsError extends Error {
	constructor(
		public diagnostics: ReadonlyArray<ts.Diagnostic>
	) {
		super(ts.formatDiagnostics(diagnostics, ts.createCompilerHost({})));
	}
}

type TWarningCallback = (msg: string) => void;

export default class TsccSpecWithTS extends TsccSpec implements ITsccSpecWithTS {
	static loadTsConfigFromArgs(tsArgs: string[], specRoot: string, onWarning: TWarningCallback) {
		const {options, fileNames, errors} = ts.parseCommandLine(tsArgs);
		if (errors.length) {
			throw new TsError(errors);
		}
		if (fileNames.length) {
			onWarning(`Files provided via TS args are ignored.`);
		}
		// If "--project" argument is supplied - load tsconfig from there, merge things with this.
		// Otherwise, we lookup from tsccSpecPath - this is what is different to "tsc" (which looks up
		// the current working directory).
		// I think this is a more reasonable behavior, since many users will just put spec.json and
		// tsconfig.json at the same directory, they will otherwise have to provide the same information
		// twice, once for tscc and once for tsc.
		const configFileName = TsccSpecWithTS.findConfigFileAndThrow(options.project, specRoot);
		return TsccSpecWithTS.loadTsConfigFromResolvedPath(configFileName, options);
	}
	// compilerOptions is a JSON object in the form of tsconfig.json's compilerOption value.
	// Its value will override compiler options.
	static loadTsConfigFromPath(tsConfigPath: string, specRoot?: string, compilerOptions?: object) {
		const configFileName = TsccSpecWithTS.findConfigFileAndThrow(tsConfigPath, specRoot);
		let options: ts.CompilerOptions = {}, errors: ts.Diagnostic[];
		if (compilerOptions) {
			({options, errors} = ts.convertCompilerOptionsFromJson(
				compilerOptions, path.dirname(configFileName)
			));
			if (errors.length) {
				throw new TsError(errors);
			}
		}
		return TsccSpecWithTS.loadTsConfigFromResolvedPath(configFileName, options);
	}
	private static findConfigFileAndThrow(searchPath: string, defaultLocation: string) {
		const configFileName =
			TsccSpecWithTS.resolveSpecFile(searchPath, 'tsconfig.json', defaultLocation);
		if (configFileName === undefined) {
			throw new TsccSpecError(`Cannot find tsconfig at ${TsccSpecWithTS.toDisplayedPath(searchPath)}.`)
		}
		return configFileName;
	}
	private static loadTsConfigFromResolvedPath(configFileName: string, options: ts.CompilerOptions) {
		const parsedConfig = ts.getParsedCommandLineOfConfigFile(configFileName, options, <any>ts.sys);
		if (parsedConfig.errors.length) {
			throw new TsError(parsedConfig.errors);
		}
		const projectRoot = path.dirname(configFileName);
		return {projectRoot, parsedConfig};
	}
	static loadSpecWithTS(
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON,
		tsConfigPathOrTsArgs?: string | string[],
		compilerOptionsOverride?: object,
		onTsccWarning: (msg: string) => void = noop
	) {
		// When TS project root is not provided, it will be assumed to be the location of tscc spec file.
		let {tsccSpecJSON, tsccSpecJSONPath} = TsccSpecWithTS.loadSpecRaw(tsccSpecJSONOrItsPath);
		let specRoot = path.dirname(tsccSpecJSONPath);
		let {projectRoot, parsedConfig} = Array.isArray(tsConfigPathOrTsArgs) ?
			TsccSpecWithTS.loadTsConfigFromArgs(tsConfigPathOrTsArgs, specRoot, onTsccWarning) :
			TsccSpecWithTS.loadTsConfigFromPath(tsConfigPathOrTsArgs, specRoot, compilerOptionsOverride);

		TsccSpecWithTS.pruneCompilerOptions(parsedConfig.options, onTsccWarning);
		return new TsccSpecWithTS(tsccSpecJSON, tsccSpecJSONPath, parsedConfig, projectRoot);
	}
	/**
	 * Prune compiler options
	 *  - "module" to "commonjs"
	 *  - Get values of outDir, strip it, and pass it to closure compiler
	 *  - Warn when rootDir is used - it is of no use.
	 */
	private static pruneCompilerOptions(options: ts.CompilerOptions, onWarning: TWarningCallback) {
		if (options.module !== ts.ModuleKind.CommonJS) {
			onWarning(`tsickle converts TypeScript modules to Closure modules via CommonJS internally.`
				+ `"module" flag is overridden to "commonjs".`);
			options.module = ts.ModuleKind.CommonJS;
		}
		if (options.outDir) {
			onWarning(`--outDir option is ignored. Use prefix option in the spec file.`);
			options.outDir = undefined;
		}
		if (options.rootDir) {
			onWarning(`--rootDir option is ignored.`);
			options.rootDir = undefined;
		}
		if (!options.importHelpers) {
			onWarning(`tsickle uses a custom tslib optimized for closure compiler. importHelpers flag is set.`);
			options.importHelpers = true;
		}
		if (options.removeComments) {
			onWarning(`Closure compiler relies on type annotations, removeComments flag is unset.`);
			options.removeComments = false;
		}
		if (options.inlineSourceMap) {
			onWarning(`Inlining sourcemap is not supported. inlineSourceMap flag is unset.`);
			options.inlineSourceMap = false;
			// inlineSource option depends on sourceMap or inlineSourceMap being enabled
			// so enabling sourceMap in order not to break tsc.
			options.sourceMap = true;
		}
	}
	private tsCompilerHost: ts.CompilerHost = ts.createCompilerHost(this.parsedConfig.options);
	constructor(
		tsccSpec: ITsccSpecJSON,
		basePath: string,
		private parsedConfig: ts.ParsedCommandLine,
		private projectRoot: string
	) {
		super(tsccSpec, basePath);
		this.validateSpec();
	}
	protected validateSpec() {
		// Checks that each of entry files is provided in tsConfig.
		const fileNames = this.getAbsoluteFileNamesSet();
		const modules = this.getOrderedModuleSpecs();
		for (let module of modules) {
			if (!fileNames.has(module.entry)) {
				throw new TsccSpecError(
					`An entry file ${module.entry} is not provided ` +
					`in a typescript project ${this.projectRoot}.`
				)
			}
		}
	}
	getTSRoot() {
		return this.projectRoot;
	}
	getCompilerOptions() {
		return this.parsedConfig.options;
	}
	getCompilerHost() {
		return this.tsCompilerHost;
	}
	private static readonly tsTargetToCcTarget = {
		[ts.ScriptTarget.ES3]: "ECMASCRIPT3",
		[ts.ScriptTarget.ES5]: "ECMASCRIPT5_STRICT",
		[ts.ScriptTarget.ES2015]: "ECMASCRIPT_2015",
		[ts.ScriptTarget.ES2016]: "ECMASCRIPT_2016",
		[ts.ScriptTarget.ES2017]: "ECMASCRIPT_2017",
		[ts.ScriptTarget.ES2018]: "ECMASCRIPT_2018",
		[ts.ScriptTarget.ES2019]: "ECMASCRIPT_2019",
		[ts.ScriptTarget.ESNext]: "ECMASCRIPT_NEXT"
	}
	getOutputFileNames(): string[] {
		return this.getOrderedModuleSpecs()
			.map(moduleSpec => {
				const {moduleName} = moduleSpec;
				return this.absolute(this.getOutputPrefix('cc')) + moduleName + '.js';
			});
	}
	private getDefaultFlags(): {[flag: string]: primitives | primitives[]} {
		let {target, sourceMap, inlineSources} = this.parsedConfig.options;

		const defaultFlags = {};
		defaultFlags["language_in"] = TsccSpecWithTS.tsTargetToCcTarget[
			typeof target === 'undefined' ? ts.ScriptTarget.ES3 : target
		]; // ts default value is ES3.
		defaultFlags["language_out"] = "ECMASCRIPT5";
		defaultFlags["compilation_level"] = "ADVANCED";
		if (this.getOrderedModuleSpecs().length > 1) {
			// Multi-chunk build uses --chunk and --chunk_output_path_prefix.
			// This path will appear in a sourcemap that closure compiler generates - need to use
			// relative path in order not to leak global directory structure.
			defaultFlags["chunk_output_path_prefix"] = this.relativeFromCwd(this.getOutputPrefix('cc'));
		} else {
			// Single-chunk build uses --js_output_file.
			defaultFlags["js_output_file"] =
				this.relativeFromCwd(this.getOutputPrefix('cc')) +
				this.getOrderedModuleSpecs()[0].moduleName + '.js';
		}
		defaultFlags["generate_exports"] = true;
		defaultFlags["export_local_property_definitions"] = true;

		if (sourceMap) {
			defaultFlags["create_source_map"] = "%outname%.map";
			defaultFlags["apply_input_source_maps"] = true;
		}
		if (inlineSources) {
			defaultFlags["source_map_include_content"] = true;
		}

		return defaultFlags;
	}
	getBaseCompilerFlags() {
		const baseFlags = this.tsccSpec.compilerFlags || {};
		const defaultFlags = this.getDefaultFlags();
		const flagsMap = Object.assign(defaultFlags, baseFlags);

		const outFlags: string[] = [];
		const pushFlag = (key: string, value: string | number | boolean) => {
			if (typeof value === 'boolean') {
				if (value === true) outFlags.push('--' + key);
			} else {
				outFlags.push('--' + key, String(value));
			}
		}
		for (let [key, value] of Object.entries(flagsMap)) {
			if (Array.isArray(value)) {
				for (let val of value) {
					pushFlag(key, val);
				}
			} else {
				pushFlag(key, value);
			}
		}
		return outFlags;
	}
	getAbsoluteFileNamesSet() {
		return new Set(
			this.parsedConfig.fileNames
				.map(fileName => path.resolve(this.projectRoot, fileName))
		);
	}
	resolveExternalModuleTypeReference(moduleName: string) {
		const resolved = ts.resolveTypeReferenceDirective(
			moduleName,
			// Following convention of Typescript source code
			path.join(this.projectRoot, '__inferred type names__.ts'),
			this.getCompilerOptions(),
			this.getCompilerHost()
		);
		if (resolved && resolved.resolvedTypeReferenceDirective &&
			resolved.resolvedTypeReferenceDirective.isExternalLibraryImport) {
			return resolved.resolvedTypeReferenceDirective.resolvedFileName;
		}
		return null;
	}
	getProjectHash(): string {
		return require('crypto').createHash('sha256')
			.update(
				this.basePath + JSON.stringify(this.tsccSpec) +
				this.projectRoot + JSON.stringify(this.parsedConfig.options)
			)
			.digest('hex');
	}
}

function noop() {}

