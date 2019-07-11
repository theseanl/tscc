import {TsccSpec, IInputTsccSpecJSON, ITsccSpecJSON, primitives, TsccSpecError} from '@tscc/tscc-spec'
import ITsccSpecWithTS from './ITsccSpecWithTS';
import * as ts from 'typescript';
import fs = require('fs');
import path = require('path');

export class TsError extends Error {
	constructor(
		public diagnostics: ReadonlyArray<ts.Diagnostic>
	) {
		super(ts.formatDiagnostics(diagnostics, ts.createCompilerHost({})));
	}
}

export default class TsccSpecWithTS extends TsccSpec implements ITsccSpecWithTS {
	static loadTsConfig(
		tsConfigRoot: string = process.cwd(),
	) {
		const configFileName = ts.findConfigFile(tsConfigRoot, fs.existsSync);
		if (configFileName === undefined) {
			throw new TsccSpecError(`Cannot find tsconfig.json at ${tsConfigRoot}.`)
		}
		const parsedConfig = ts.getParsedCommandLineOfConfigFile(configFileName, {}, <any>ts.sys);
		if (parsedConfig.errors.length) {
			throw new TsError(parsedConfig.errors);
		}
		return {configFileName, parsedConfig};
	}
	static loadSpecWithTS(
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON,
		tsConfigRoot?: string,
		onTsccWarning: (msg: string) => void = noop
	) {
		// When TS project root is not provided, it will be assumed to be the location of tscc spec file.
		let {tsccSpecJSON, tsccSpecJSONPath} = TsccSpecWithTS.loadSpecRaw(tsccSpecJSONOrItsPath);
		let {configFileName, parsedConfig} = TsccSpecWithTS.loadTsConfig(tsConfigRoot || tsccSpecJSONPath);
		/**
		 * Prune compiler options
		 *  - "module" to "commonjs"
		 *  - Get values of outDir, strip it, and pass it to closure compiler
		 *  - Warn when rootDir is used - it is of no use.
		 */
		const options = parsedConfig.options;
		if (options.module !== ts.ModuleKind.CommonJS) {
			onTsccWarning(`tsickle converts TypeScript modules to Closure modules via CommonJS internally.`
				+ `"module" flag is overridden to "commonjs".`);
			options.module = ts.ModuleKind.CommonJS;
		}
		if (options.outDir) {
			onTsccWarning(`--outDir option is ignored. Use prefix option in the spec file.`);
			options.outDir = undefined;
		}
		if (options.rootDir) {
			onTsccWarning(`--rootDir option is ignored.`);
			options.rootDir = undefined;
		}
		if (!options.importHelpers) {
			onTsccWarning(`tsickle uses its own tslib optimized for closure compiler. importHelpers flag is set.`);
			options.importHelpers = true;
		}
		if (options.removeComments) {
			onTsccWarning(`Closure compiler relies on type annotations, removeComments flag is unset.`);
			options.removeComments = false;
		}
		if (options.inlineSourceMap) {
			onTsccWarning(`Inlining sourcemap is not supported. inlineSourceMap flag is unset.`);
			options.inlineSourceMap = false;
			// inlineSource option depends on sourceMap or inlineSourceMap being enabled
			// so enabling sourceMap in order not to break tsc.
			options.sourceMap = true;
		}
		return new TsccSpecWithTS(tsccSpecJSON, tsccSpecJSONPath, parsedConfig, configFileName);
	}
	private tsCompilerHost: ts.CompilerHost = ts.createCompilerHost(this.parsedConfig.options);
	constructor(
		tsccSpec: ITsccSpecJSON,
		basePath: string,
		private parsedConfig: ts.ParsedCommandLine,
		private tsconfigPath: string
	) {
		super(tsccSpec, basePath);
	}
	getTSRoot() {
		return path.dirname(this.tsconfigPath);
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
				.map(fileName => path.resolve(path.dirname(this.tsconfigPath), fileName))
		);
	}
	resolveExternalModuleTypeReference(moduleName: string) {
		const resolved = ts.resolveTypeReferenceDirective(
			moduleName,
			// Following convention of Typescript source code
			path.join(path.dirname(this.tsconfigPath), '__inferred type names__.ts'),
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
				this.tsconfigPath + JSON.stringify(this.parsedConfig.options)
			)
			.digest('hex');
	}
	isDebug() {
		return this.tsccSpec.debug === true;
	}
}

function noop() {}
function exit() {return process.exit(1);}

