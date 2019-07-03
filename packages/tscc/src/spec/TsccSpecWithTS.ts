import {TsccSpec, IInputTsccSpecJSON, ITsccSpecJSON, TsccSpecError} from '@tscc/tscc-spec'
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
	private static loadTsConfig(
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
		tsConfigRoot: string,
		onTsccWarning: (msg: string) => void = noop
	) {
		let {tsccSpecJSON, tsccSpecJSONPath} = TsccSpecWithTS.loadSpecRaw(tsccSpecJSONOrItsPath);
		let {configFileName, parsedConfig} = TsccSpecWithTS.loadTsConfig(tsConfigRoot);
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
			onTsccWarning(`tsickle does not use --outDir, it is ignored.`);
			options.outDir = null;
		}
		if (!options.importHelpers) {
			onTsccWarning(`tsickle uses its own tslib optimized for closure compiler. importHelpers flag is set.`);
			options.importHelpers = true;
		}
		if (options.removeComments) {
			onTsccWarning(`Closure compiler relies on type annotations, removeComments flag is unset.`);
			options.removeComments = false;
		}
		return new TsccSpecWithTS(tsccSpecJSON, tsccSpecJSONPath,
			parsedConfig, configFileName);
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
	getBaseCompilerFlags() {
		const baseFlags = this.tsccSpec.compilerFlags || {};
		const defaultFlags = {};

		defaultFlags["language_in"] = TsccSpecWithTS.tsTargetToCcTarget[
			this.parsedConfig.options.target || ts.ScriptTarget.ES3 
		]; // ts default value is ES3.
		defaultFlags["language_out"] = "ECMASCRIPT5";
		defaultFlags["compilation_level"] = "ADVANCED";
		if (this.getOrderedModuleSpecs().length > 1) {
			// Multi-chunk build uses --chunk and --chunk_output_path_prefix.
			defaultFlags["chunk_output_path_prefix"] = this.absolute(this.getOutputPrefix('cc'));
		} else {
			// Single-chunk build uses --js_output_file.
			defaultFlags["js_output_file"] = 
				this.absolute(this.getOutputPrefix('cc')) + 
				this.getOrderedModuleSpecs()[0].moduleName + '.js';
		}

		const flagsMap = Object.assign(defaultFlags, baseFlags);
		const outFlags: string[] = [];
		for (let [key, value] of Object.entries(flagsMap)) {
			if (Array.isArray(value)) {
				for (let val of value) {
					outFlags.push('--' + key, String(val));
				}
			} else {
				outFlags.push('--' + key, String(value));
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

