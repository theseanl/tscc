import {TsccSpec, TsccSpecError} from '@tscc/tscc-spec';
import ITsccSpecRollupFacade from './ITsccSpecRollupFacade'
import MultiMap from '../MultiMap';
import {ModuleFormat} from 'rollup';

export default class TsccSpecRollupFacade extends TsccSpec implements ITsccSpecRollupFacade {
	resolveRollupExternalDeps(moduleId: string) {
		return ''; // Just a stub
	}
	protected getOutputPrefix(target: "cc" | "rollup"): string {
		let prefix = this.tsccSpec.prefix;
		if (typeof prefix === 'undefined') return '';
		if (typeof prefix === 'string') return prefix;
		return prefix[target];
	}
	private getResolvedRollupPrefix() {
		let prefix = this.getOutputPrefix("rollup");
		let resolvedPrefix = this.relativeFromCwd(prefix);
		if (resolvedPrefix.startsWith('.')) {
			throw new TsccSpecError(
				`Output file prefix ${resolvedPrefix} escapes the current working directory`
			);
		}
		return resolvedPrefix;
	}
	private rollupPrefix = this.getResolvedRollupPrefix();
	private addPrefix(name: string) {
		return this.rollupPrefix + name;
	}
	private addPrefixAndExtension(name: string) {
		return this.rollupPrefix + name + '.js';
	}
	getRollupOutputNameToEntryFileMap() {
		let out: {[name: string]: string} = {};
		for (let {moduleName, entry} of this.getOrderedModuleSpecs()) {
			// If entryFile is a relative path, resolve it relative to the path of tsccSpecJSON.
			out[this.addPrefix(moduleName)] = this.absolute(entry);
		}
		return out;
	}
	getRollupOutputNameDependencyMap() {
		let out = new MultiMap<string, string>();
		for (let {moduleName, dependencies} of this.getOrderedModuleSpecs()) {
			// we set outputOption.entryFileName as [name].js - gotta add .js to match
			// an expected output file name.
			out.putAll(
				this.addPrefixAndExtension(moduleName),
				dependencies.map(this.addPrefixAndExtension, this));
		}
		return out
	}
	getRollupExternalModuleNamesToGlobalMap() {
		const globals: {[moduleName: string]: string} = {};
		let external = this.getExternalModuleDataMap();
		for (let [moduleName, {globalName}] of external) {
			globals[moduleName] = globalName;
		}
		return globals;
	}
	getRollupOutputModuleFormat(): ModuleFormat {
		switch (this.tsccSpec.chunkFormat) {
			case 'module':
				return 'es';
			case 'global':
			default:
				return 'iife';
		}
	}
}

