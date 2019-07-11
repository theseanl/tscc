import ITsccSpec from './ITsccSpec';
import ITsccSpecJSON, {IModule, INamedModuleSpecs} from './ITsccSpecJSON';
import {DirectedTree, CycleError} from './shared/Graph';
import path = require('path');
import fs = require('fs');
import fg = require('fast-glob');

export interface IInputTsccSpecJSON extends ITsccSpecJSON {
	/**
	 * If exists, the plugin will first load the spec from the specified path,
	 * and then override it with properties provided in this object.
	 */
	specFile?: string
}

export default class TsccSpec implements ITsccSpec {
	private static resolveTsccSpec(root: string): string {
		if (!fs.existsSync(root)) return;
		if (fs.lstatSync(root).isFile()) return path.resolve(root);
		let specPath = path.resolve(root, 'tscc.spec.js');
		if (fs.existsSync(specPath)) return specPath;
		specPath = path.resolve(root, 'tscc.spec.json');
		if (fs.existsSync(specPath)) return specPath;
	}
	protected static loadSpecRaw(
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON
	) {
		const tsccSpecJSONPath: string =
			typeof tsccSpecJSONOrItsPath === 'string' ?
				TsccSpec.resolveTsccSpec(tsccSpecJSONOrItsPath) :
				typeof tsccSpecJSONOrItsPath === 'object' ?
					typeof tsccSpecJSONOrItsPath.specFile === 'string' ?
						TsccSpec.resolveTsccSpec(tsccSpecJSONOrItsPath.specFile) :
						process.cwd() + "/tscc.spec.json" : // Just a dummy path
					TsccSpec.resolveTsccSpec(process.cwd());

		if (typeof tsccSpecJSONPath === 'undefined') {
			throw new TsccSpecError(`No spec file was found from directory ${tsccSpecJSONOrItsPath || "cwd"}`)
		}

		const tsccSpecJSON: ITsccSpecJSON =
			typeof tsccSpecJSONOrItsPath === 'object' ?
				typeof tsccSpecJSONOrItsPath.specFile === 'string' ?
					Object.assign(
						tsccSpecJSONOrItsPath,
						require(TsccSpec.resolveTsccSpec(tsccSpecJSONOrItsPath.specFile))
					) :
					tsccSpecJSONOrItsPath :
				<ITsccSpecJSON>require(tsccSpecJSONPath);

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
			this.orderedModuleSpecs = modules;
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
		let base = /^[\.]{1,2}\//.test(filePath) ?
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
}

export class TsccSpecError extends Error {}

