import ITsccSpec, {INamedModuleSpecs} from './ITsccSpec';
import ITsccSpecJSON, {IModule} from './ITsccSpecJSON';
import path = require('path');
import fs = require('fs');
import toposort = require('toposort');
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
	static loadSpec(
		tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON
	): TsccSpec {
		let {tsccSpecJSON, tsccSpecJSONPath} = TsccSpec.loadSpecRaw(tsccSpecJSONOrItsPath);
		return new TsccSpec(tsccSpecJSON, tsccSpecJSONPath);
	}
	constructor(
		protected readonly tsccSpec: ITsccSpecJSON,
		protected basePath: string
	) {}
	// Returns an absolute path by resolving filePath appropriately.
	protected absolute(filePath: string): string {
		// If starts with ".", resolve relative to the spec file's path.
		// If it is still not an absolute path, resolve relative to the current working directory.
		// Otherwise, use as it.
		// Make sure to preserve the trailing path separator.
		if (path.isAbsolute(filePath)) return filePath;
		let endsWithSep = filePath.endsWith(path.sep);
		let base = /^[\.]{1,2}\//.test(filePath) ?
			path.dirname(this.basePath) :
			process.cwd();
		// path.resolve trims trailing separators.
		return path.resolve(base, filePath) + (endsWithSep ? path.sep : '');
	}
	protected relativeFromCwd(filePath: string): string {
		let absolute = this.absolute(filePath);
		let endsWithSep = absolute.endsWith(path.sep);
		return path.relative(process.cwd(), absolute) + (endsWithSep ? path.sep : '');
	}
	resolveRollupExternalDeps(moduleId: string) {
		return null; // Just a stub
	}
	protected getOutputPrefix(target: "cc" | "rollup"): string {
		let prefix = this.tsccSpec.prefix;
		if (typeof prefix === 'undefined') return '';
		if (typeof prefix === 'string') return prefix;
		return prefix[target];
	}
	protected getModule(moduleName: string): IModule {
		let module = this.tsccSpec.modules[moduleName];
		if (typeof module === 'string') return {entry: module};
		return module;
	}
	getOutputNameToEntryFileMap() {
		let out = {};
		let prefix = this.getOutputPrefix("rollup");
		let resolvedPrefix = this.relativeFromCwd(prefix);
		if (resolvedPrefix.startsWith('.')) {
			throw new TsccSpecError(`Output file prefix ${resolvedPrefix} resides outside of the current working directory`);
		}
		for (let moduleName in this.tsccSpec.modules) {
			let entryFile = this.getModule(moduleName).entry;
			// If entryFile is a relative path, resolve it relative to the path of tsccSpecJSON.
			out[resolvedPrefix + moduleName] = this.absolute(entryFile);
		}
		return out;
	}
	shouldUseClosureDeps() {
		return this.tsccSpec.closureLibrary === true;
	}
	getOrderedModuleSpecs() {
		// TODO Closure compiler requires modules to have a single common root.
		// We may validate it and produce error here.
		const edges: [string, string][] = [];
		for (let moduleName in this.tsccSpec.modules) {
			let deps = this.getModule(moduleName).dependencies;
			if (!deps) continue;
			for (let dep of deps) {
				edges.push([moduleName, dep]);
			}
		}
		let sorted: ReadonlyArray<string>;
		if (edges.length === 0) {
			// This happens iff there is a single module due to a common root requirement.
			sorted = Object.keys(this.tsccSpec.modules);
		} else {
			try {
				sorted = toposort(edges);
			} catch (e) {
				throw new TsccSpecError(`Circular dependency in modules`);
			}
		}
		return sorted.map(this.moduleNameToNamedModule, this);
	}
	private moduleNameToNamedModule(moduleName: string): INamedModuleSpecs {
		let module = this.getModule(moduleName);
		const out: Partial<INamedModuleSpecs> = {};
		if ('entry' in module) {
			out.entry = this.absolute(module.entry);
		}
		if ('dependencies' in module) out.dependencies = module.dependencies.slice();
		if ('extraSources' in module) out.extraSources = module.extraSources.slice();
		out.moduleName = moduleName;
		return <INamedModuleSpecs>out;
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

