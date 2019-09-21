import ITsccSpec from './ITsccSpec';
import ITsccSpecJSON, {IModule, INamedModuleSpecs, IDebugOptions} from './ITsccSpecJSON';
import {DirectedTree, CycleError} from './shared/Graph';
import path = require('path');
import fs = require('fs');
import process = require('process');
import {readJsonSync} from 'fs-extra';
import fg = require('fast-glob');

// "modules" key is no longer required
interface IInputTsccSpecJSONWithSpecFile extends Partial<ITsccSpecJSON> {
	/**
	 * If exists, the plugin will first load the spec from the specified path,
	 * and then override it with properties provided in this object.
	 */
	specFile: string
}

interface IInputTsccSpecJSONWithOptionalSpecFile extends ITsccSpecJSON {
	specFile?: string
}

export type IInputTsccSpecJSON = IInputTsccSpecJSONWithOptionalSpecFile | IInputTsccSpecJSONWithSpecFile;

function hasSpecFileKey(json: IInputTsccSpecJSON): json is IInputTsccSpecJSONWithSpecFile {
	return typeof json.specFile === 'string';
}

export default class TsccSpec implements ITsccSpec {
	protected static readonly SPEC_FILE = 'tscc.spec.json';
	private static readonly RE_DOT_PATH = /^[\.]{1,2}\//;
	private static isDotPath(p:string) { return TsccSpec.RE_DOT_PATH.test(p); }
	/**
	 * Follows the behavior of Typescript CLI.
	 * 1. If --project argument is supplied,
	 *   1-1. If it is a file, use it.
	 *   1-2. If it is a directory, use directory/tsconfig.json.
	 *   1-3. If it is not a file nor a directory, throw an error.
	 * 2. If it is not supplied (and file arguments are not supplied which is always the case for tscc)
	 *    it calls ts.findConfigFile to search for tsconfig.json from the current working directory.
	 */
	protected static resolveSpecFile(
		searchPath: string | undefined,
		specFileName: string,
		defaultLocation?: string
	): string {
		if (typeof searchPath === 'string') { // 1
			try {
				let stat = fs.statSync(searchPath); // Throws if does not exist
				if (stat.isFile()) return path.resolve(searchPath); // 1-1;
				if (stat.isDirectory()) { // 1-2;
					let specPath = path.resolve(searchPath, specFileName);
					let specStat = fs.statSync(specPath); // Throws if does not exist
					if (specStat.isFile()) return specPath;
				}
			} catch (e) {}
			return; // 1-3
		}
		// Search ancestor directories starting from defaultLocation, similar to ts.findConfigFile
		let nextPath = defaultLocation;
		while (nextPath !== searchPath) {
			searchPath = nextPath;
			try {
				let specPath = path.resolve(searchPath, specFileName);
				let stat = fs.statSync(specPath);
				if (stat.isFile()) return specPath;
			} catch (e) {}
			nextPath = path.dirname(searchPath);
		}
		return;
	}
	// A helper function for creating path strings to display in terminal environments
	protected static toDisplayedPath(p: string): string {
		const relPath = path.relative('.', p);
		if (TsccSpec.isDotPath(relPath)) return path.resolve(p); // use an absolute path
		if (relPath === '.') return "the current working directory";
		return relPath;
	}
	private static findTsccSpecAndThrow(root: string): string {
		const specPath = TsccSpec.resolveSpecFile(root, TsccSpec.SPEC_FILE, process.cwd());
		if (specPath === undefined) {
			let displayedPath = TsccSpec.toDisplayedPath(root || process.cwd());
			throw new TsccSpecError(`No spec file was found from ${displayedPath}.`);
		}
		return specPath;
	}
	protected static loadSpecRaw(
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON
	) {
		const tsccSpecJSONPath: string =
			typeof tsccSpecJSONOrItsPath === 'string' ?
				TsccSpec.findTsccSpecAndThrow(tsccSpecJSONOrItsPath) :
				typeof tsccSpecJSONOrItsPath === 'object' ?
					hasSpecFileKey(tsccSpecJSONOrItsPath) ?
						TsccSpec.findTsccSpecAndThrow(tsccSpecJSONOrItsPath.specFile) :
						path.join(process.cwd(), TsccSpec.SPEC_FILE) : // Just a dummy path
					TsccSpec.findTsccSpecAndThrow(undefined); // Searches in ancestor directories

		const readSpecJSON = (): ITsccSpecJSON => {
			try {
				return readJsonSync(tsccSpecJSONPath);
			} catch (e) {
				throw new TsccSpecError(
					`Spec file is an invalid JSON: ${TsccSpec.toDisplayedPath(tsccSpecJSONPath)}.`
				);
			}
		};

		const tsccSpecJSON: ITsccSpecJSON =
			typeof tsccSpecJSONOrItsPath === 'object' ?
				hasSpecFileKey(tsccSpecJSONOrItsPath) ?
					Object.assign(readSpecJSON(), tsccSpecJSONOrItsPath) :
					tsccSpecJSONOrItsPath :
				readSpecJSON();

		return {tsccSpecJSON, tsccSpecJSONPath};
	}
	static loadSpec<T extends typeof TsccSpec>(
		this: T,
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON
	): InstanceType<T> {
		let {tsccSpecJSON, tsccSpecJSONPath} = TsccSpec.loadSpecRaw(tsccSpecJSONOrItsPath);
		return <InstanceType<T>>new this(tsccSpecJSON, tsccSpecJSONPath);
	}
	constructor(
		protected readonly tsccSpec: ITsccSpecJSON,
		protected basePath: string
	) {
		this.computeOrderedModuleSpecs();
	}
	private orderedModuleSpecs: INamedModuleSpecs[];
	private computeOrderedModuleSpecs() {
		const modules = this.tsccSpec.modules;
		if (Array.isArray(modules)) {
			// Use it as is, TODO but check whether it is sorted
			this.orderedModuleSpecs =
				modules.map(module => this.interopModuleSpecs(module.moduleName, module))
			return;
		}
		// TODO Closure compiler requires modules to have a single common root.
		// We may validate it and produce error here.
		const graph = new DirectedTree<string>();
		for (let moduleName in modules) {
			graph.addNodeById(moduleName);
			// Can be a string literal or IModule
			let moduleSpecOrModuleEntryFile = modules[moduleName];
			if (typeof moduleSpecOrModuleEntryFile === 'string') continue;
			let deps = moduleSpecOrModuleEntryFile.dependencies;
			if (!deps) continue;
			for (let dep of deps) {
				graph.addEdgeById(dep, moduleName);
			}
		}
		let sorted: ReadonlyArray<string>;
		try {
			sorted = graph.sort();
		} catch (e) {
			if (e instanceof CycleError) {
				throw new TsccSpecError(`Circular dependency in modules ${[...e.cycle]}`);
			}
		}
		this.orderedModuleSpecs = sorted.map(moduleName => {
			return this.interopModuleSpecs(moduleName, modules[moduleName]);
		})
	}
	getOrderedModuleSpecs() {
		return this.orderedModuleSpecs;
	}
	private interopModuleSpecs(moduleName: string, moduleSpec: IModule | string): INamedModuleSpecs {
		let spec: Partial<INamedModuleSpecs> =
			typeof moduleSpec === 'string' ? {entry: moduleSpec} : moduleSpec;
		if (!('dependencies' in spec)) spec.dependencies = [];
		if (!('extraSources' in spec)) spec.extraSources = [];
		spec.moduleName = moduleName;
		// Resolve entry file name to absolute path
		spec.entry = this.absolute(spec.entry);
		return <INamedModuleSpecs>spec;
	}
	/**
	 * Paths specified in TSCC spec are resolved with following strategy:
	 *  - If starts with "./" or "../", resolve relative to the spec file's path.
	 *  - If it is still not an absolute path, resolve relative to the current working directory.
	 *    as if cwd is in the PATH.
	 *  - Otherwise, use the absolute path as is.
	 *  Also, it preserves the trailing path separator. This, for example, has semantic difference
	 *  in closure compiler's 'chunk_output_path_prefix' option.
	 */
	protected absolute(filePath: string): string {
		if (path.isAbsolute(filePath)) return filePath;
		// Special handling for '' - treat it as if it ends with a separator
		let endsWithSep = filePath.endsWith(path.sep) || filePath.length === 0;
		let base = TsccSpec.isDotPath(filePath) ?
			path.dirname(this.basePath) :
			process.cwd();
		// path.resolve trims trailing separators.
		return path.resolve(base, filePath) + (endsWithSep ? path.sep : '');
	}
	/**
	 * Resolves with TSCC's convention, but as a relative path from current working directory.
	 */
	protected relativeFromCwd(filePath: string): string {
		let absolute = this.absolute(filePath);
		let endsWithSep = absolute.endsWith(path.sep);
		const relative = path.relative(process.cwd(), absolute);
		// Special handling for '' - do not add a separator at the end
		return relative + (endsWithSep && relative.length > 0 ? path.sep : '');
	}
	protected getOutputPrefix(target: "cc" | "rollup"): string {
		let prefix = this.tsccSpec.prefix;
		if (typeof prefix === 'undefined') return '';
		if (typeof prefix === 'string') return prefix;
		return prefix[target];
	}
	getExternalModuleNames() {
		if (!this.tsccSpec.external) return [];
		return Object.keys(this.tsccSpec.external);
	}
	getExternalModuleNamesToGlobalsMap() {
		if (!this.tsccSpec.external) return {};
		return Object.assign({}, this.tsccSpec.external);
	}
	getJsFiles() {
		let jsFiles = this.tsccSpec.jsFiles;
		if (jsFiles) {
			return <string[]>fg.sync(this.tsccSpec.jsFiles)
		}
		return [];
	}
	debug(): Readonly<IDebugOptions> {
		return this.tsccSpec.debug || {};
	}
}

export class TsccSpecError extends Error {}

