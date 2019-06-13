import {TsccSpec, IInputTsccSpecJSON, ITsccSpecJSON} from '@tscc/tscc-spec'
import ITsccSpecWithTS from './ITsccSpecWithTS';
import * as ts from 'typescript';
import fs = require('fs');
import path = require('path');

export class TsError extends Error {
	constructor(
		public diagnostics:ReadonlyArray<ts.Diagnostic>
	) {
		super(ts.formatDiagnostics(diagnostics, ts.createCompilerHost({})));
	}
}

export default class TsccSpecWithTS extends TsccSpec implements ITsccSpecWithTS {
	private static loadTsConfig(
		tsConfigRoot: string = process.cwd(),
	) {
		const configFileName = ts.findConfigFile(tsConfigRoot, fs.existsSync);
		const {config: json, error} = ts.readConfigFile(configFileName, ts.sys.readFile);
		if (error) {
			throw new TsError([error])
		}
		const parsedConfig = ts.parseJsonConfigFileContent(
			json, ts.sys, path.dirname(configFileName),
			{}, configFileName
		);
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
			onTsccWarning(`tsickle uses its own tslib optimized for closure compiler, importHelpers option was set forcibly.`);
			options.importHelpers = true;
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
	getOutputFileNames():string[] {
		return Object.keys(this.tsccSpec.modules).map(moduleName => {
			return this.absolute(this.getOutputPrefix('cc')) + moduleName + '.js';
		});
	}
	getBaseCompilerFlags() {
		const baseFlags = this.tsccSpec.compilerFlags || {};

		const language_in: string = baseFlags["language_in"] ||
			TsccSpecWithTS.tsTargetToCcTarget[this.parsedConfig.options.target];
		const language_out = baseFlags["language_out"] || "ECMASCRIPT5";
		const compilation_level = baseFlags["compilation_level"] || "ADVANCED";
		const chunk_output_path_prefix = baseFlags["chunk_output_path_prefix"] ||
			this.absolute(this.getOutputPrefix('cc'));

		const flagsMap = Object.assign({
			language_in,
			language_out,
			compilation_level,
			chunk_output_path_prefix
		}, baseFlags);
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
		return new Set(this.parsedConfig.fileNames.map(fileName => path.resolve(fileName)));
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
	getExternalModuleNamesToTypeReferenceMap() {
		const out = new Map();
		this.getExternalModuleNames().forEach(moduleName => {
			let typeRef = this.resolveExternalModuleTypeReference(moduleName) || moduleName;
			out.set(moduleName, typeRef);
		});
		return out;
	}
	getExternalModulesTypeReference() {
		return this.getExternalModuleNames()
			.map(this.resolveExternalModuleTypeReference, this)
			.filter(resolvedFileName => !!resolvedFileName)
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

