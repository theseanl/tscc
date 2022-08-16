import * as rollup from 'rollup';
import MultiMap from './MultiMap';
import path = require('path');
import upath = require('upath');
import {googShimMixin} from './goog_shim_mixin';

type CodeSplittableModuleFormat = Exclude<rollup.ModuleFormat, 'iife' | 'umd'>;

export async function mergeIIFE(
	entry: string,
	chunkAllocation: MultiMap<string, string>,
	bundle: Readonly<rollup.OutputBundle>,
	globals?: {[id: string]: string},
	format: rollup.ModuleFormat = 'iife'
) {
	return await new ChunkMerger(chunkAllocation, bundle, globals).performSingleEntryBuild(entry, format);
}

export async function mergeAllES(
	chunkAllocation: MultiMap<string, string>,
	bundle: Readonly<rollup.OutputBundle>,
	globals?: {[id: string]: string},
	format: CodeSplittableModuleFormat = 'es'
) {
	return await new ChunkMerger(chunkAllocation, bundle, globals).performCodeSplittingBuild(format);
}

// Merge chunks to their allocated entry chunk.
// For each entry module, create a facade module that re-exports everything from chunks
// allocated to it, and call rollup to create a merged bundle.
// Each chunk's export object is exported as a separate namespace, whose name is chosen
// so as not to collide with exported names of the entry module. We pass this namespace
// as rollup's global option in order to reference those from other chunks.
export class ChunkMerger {
	private entryModuleNamespaces!: Map<string, string> // Initialized in getBundleOutput call.
	private chunkNamespaces!: Map<string, string>
	private unresolveChunk!: Map<string, string>;
	constructor(
		private chunkAllocation: MultiMap<string, string>,
		private bundle: Readonly<rollup.OutputBundle>,
		private globals?: {[id: string]: string}
	) {
		this.populateEntryModuleNamespaces();
		this.populateUnresolveChunk();
	}
	private resolveGlobalForMainBuild(id: string) {
		if (typeof this.globals !== 'object') return;
		if (!this.globals.hasOwnProperty(id)) return;
		return this.globals[id];
	}
	private populateEntryModuleNamespaces() {
		this.entryModuleNamespaces = new Map();
		for (let entry of this.chunkAllocation.keys()) {
			let fileName = path.basename(entry, '.js');
			let fileNamespace = fileName.replace(/[^0-9a-zA-Z_$]/g, '_').replace(/^[^a-zA-Z_$]/, '_');
			this.entryModuleNamespaces.set(entry, fileNamespace);
		}
	}
	private populateChunkNamespaces() {
		const DOLLAR_SIGN = "$";
		this.chunkNamespaces = new Map();
		for (let entry of this.chunkAllocation.keys()) {
			let counter = -1;
			for (let chunk of this.chunkAllocation.iterateValues(entry)!) {
				if (entry === chunk) continue;
				let namesExportedByEntry = (this.bundle[entry] as rollup.OutputChunk).exports;
				do {
					counter++
				} while (namesExportedByEntry.includes(DOLLAR_SIGN + counter))
				this.chunkNamespaces.set(chunk, DOLLAR_SIGN + counter);
			}
		}
	}
	private populateUnresolveChunk() {
		this.unresolveChunk = new Map();
		for (let [entry, chunk] of this.chunkAllocation) {
			this.unresolveChunk.set(path.resolve(chunk), chunk);
		}
	}
	static readonly FACADE_MODULE_ID = `facade.js`;
	private createFacadeModuleCode(entry: string): string {
		const importStmts: string[] = [];
		const exportStmts: string[] = [];
		// nodejs specification only allows posix-style path separators in module IDs.
		exportStmts.push(`export * from '${upath.toUnix(entry)}'`);
		for (let chunk of this.chunkAllocation.iterateValues(entry)!) {
			if (chunk === entry) continue;
			let chunkNs = this.chunkNamespaces.get(chunk);
			importStmts.push(`import * as ${chunkNs} from '${upath.toUnix(chunk)}'`);
			exportStmts.push(`export { ${chunkNs} }`);
		}
		const facadeModuleCode = [...importStmts, ...exportStmts].join('\n');
		return facadeModuleCode;
	}
	private createLoaderPlugin(entry: string): rollup.Plugin {
		const {bundle} = this;
		const resolveId: rollup.ResolveIdHook = (id, importer) => {
			if (id === ChunkMerger.FACADE_MODULE_ID) return id;
			if (this.resolveGlobalForMainBuild(id)) {return {id, external: true}}
			if (this.chunkAllocation.find(entry, id)) return id;
			if (importer) {
				const resolved = path.resolve(path.dirname(importer), id);
				let unresolved = this.unresolveChunk.get(resolved);
				if (typeof unresolved === 'string') {
					let allocatedEntry = this.chunkAllocation.findValue(unresolved);
					if (allocatedEntry === entry) return unresolved;
					return {id: resolved, external: "absolute"}
				}
			}
			// This code path should not be taken
			ChunkMerger.throwUnexpectedModuleError(id, importer);
		};
		const load: rollup.LoadHook = (id) => {
			if (id === ChunkMerger.FACADE_MODULE_ID) return this.createFacadeModuleCode(entry);
			if (this.chunkAllocation.find(entry, id)) {
				let outputChunk = <rollup.OutputChunk>bundle[id];
				return {
					code: outputChunk.code,
					map: toInputSourceMap(outputChunk.map)
				}
			}
			// This code path should not be taken
			ChunkMerger.throwUnexpectedModuleError(id);
		};
		const name = "tscc-merger";
		return googShimMixin({name, resolveId, load});
	}
	private createLoaderPlugin2(): rollup.Plugin {
		const resolveId: rollup.ResolveIdHook = (id, importer) => {
			if (this.resolveGlobalForMainBuild(id)) {return {id, external: true}}
			if (this.bundle[id]) return id;
			if (importer) {
				const resolved = path.resolve(path.dirname(importer), id);
				let unresolved = this.unresolveChunk.get(resolved);
				if (typeof unresolved === 'string') {
					if (this.bundle[unresolved]) return unresolved;
					return {id: resolved, external: "absolute"};
				}
			}
			// This code path should not be taken
			ChunkMerger.throwUnexpectedModuleError(id, importer);
		};
		const load: rollup.LoadHook = (id) => {
			let outputChunk = this.bundle[id] as rollup.OutputChunk | undefined;
			if (!outputChunk) ChunkMerger.throwUnexpectedModuleError(id);
			return {
				code: outputChunk.code,
				map: toInputSourceMap(outputChunk.map)
			};
		};
		const name = "tscc-merger";
		return googShimMixin({name, resolveId, load});
	}
	private resolveGlobal(id: string): string {
		if (this.resolveGlobalForMainBuild(id)) return this.globals![id]!;
		if (path.isAbsolute(id)) {
			id = this.unresolveChunk.get(id) || ChunkMerger.throwUnexpectedModuleError(id);
		}
		let allocated = this.chunkAllocation.findValue(id);
		if (allocated === undefined) ChunkMerger.throwUnexpectedModuleError(id);
		// The below case means that the chunk being queried shouldn't be global. Rollup expects
		// outputOption.globals to return its input unchanged for non-global module ids, but this
		// code path won't and shouldn't be taken.
		// if (allocated === this.entry) ChunkMerger.throwUnexpectedModuleError(id);
		// Resolve to <namespace-of-entry-module-that-our-chunk-is-allocated>.<namespace-of-our-chunk>
		let ns = this.entryModuleNamespaces.get(allocated)!;
		if (allocated !== id) ns += '.' + this.chunkNamespaces.get(id);
		return ns;
	}
	/**
	 * Merges chunks for a single entry point, making output bundles reference each other by
	 * variables in global scope. We control global variable names via `output.globals` option.
	 * TODO: inherit outputOption provided by the caller
	 */
	async performSingleEntryBuild(entry: string, format: rollup.ModuleFormat): Promise<rollup.OutputChunk> {
		this.populateChunkNamespaces();
		const myBundle = await rollup.rollup({
			input: ChunkMerger.FACADE_MODULE_ID,
			plugins: [this.createLoaderPlugin(entry)]
		});
		const {output} = await myBundle.generate({
			...ChunkMerger.baseOutputOption,
			name: this.entryModuleNamespaces.get(entry),
			file: ChunkMerger.FACADE_MODULE_ID,
			format,
			globals: (id) => this.resolveGlobal(id),
		});
		if (output.length > 1) {
			ChunkMerger.throwUnexpectedChunkInSecondaryBundleError(output);
		}
		const mergedBundle = output[0];

		// 0. Fix fileName to that of entry file
		mergedBundle.fileName = entry;
		// 1. Remove facadeModuleId, as it would point to our virtual module
		mergedBundle.facadeModuleId = null;
		// 2. Fix name to that of entry file
		const name = (<rollup.OutputChunk>this.bundle[entry]).name;
		Object.defineProperty(mergedBundle, 'name', {
			get() {return name;} // TODO: FIXME
		});
		// 3. Remove virtual module from .modules
		delete mergedBundle.modules[ChunkMerger.FACADE_MODULE_ID];

		return mergedBundle
	}
	/**
	 * We perform the usual rollup bundling which does code splitting. Note that this is unavailable
	 * for iife and umd builds. In order to control which chunks are emitted, we control them by
	 * feeding `chunkAllocation` information to rollup via `output.manualChunks` option.
	 * TODO: inherit outputOption provided by the caller
	 */
	async performCodeSplittingBuild(format: CodeSplittableModuleFormat) {
		const myBundle = await rollup.rollup({
			input: [...this.chunkAllocation.keys()],
			plugins: [this.createLoaderPlugin2()],
			// If this is not set, rollup may create "facade modules" for each of entry modules,
			// which somehow "leaks" from `manualChunks`. On the other hand, setting this may make
			// rollup to drop `export` statements in entry files from final chunks. However, Closure
			// Compiler does this anyway, so it is ok in terms of the goal of this plugin, which
			// aims to provide an isomorphic builds.
			preserveEntrySignatures: false
		});
		const {output} = await myBundle.generate({
			...ChunkMerger.baseOutputOption,
			dir: '.', format,
			manualChunks: (id: string) => {
				let allocatedEntry = this.chunkAllocation.findValue(id);
				if (!allocatedEntry) ChunkMerger.throwUnexpectedModuleError(id);
				return trimExtension(allocatedEntry);
			},
		});
		if (output.length > this.chunkAllocation.size) {
			ChunkMerger.throwUnexpectedChunkInSecondaryBundleError(output);
		}
		return output as rollup.OutputChunk[];
	}
	private static readonly baseOutputOption: rollup.OutputOptions = {
		interop: 'esModule',
		esModule: false,
		freeze: false
	}
	private static throwUnexpectedModuleError(id: string, importer = ""): never {
		throw new ChunkMergeError(`Unexpected module in primary bundle output: ${id} ${importer}`);
	}
	private static throwUnexpectedChunkInSecondaryBundleError(output: (rollup.OutputChunk | rollup.OutputAsset)[]) {
		throw new ChunkMergeError(`Unexpected chunk in secondary bundle output: ${output[output.length - 1].name}. Please report this error.`)
	}
}

export class ChunkMergeError extends Error {}

/**
 * Converts SourceMap type used by OutputChunk type to ExistingRawSourceMap type used by load hooks.
 */
function toInputSourceMap(sourcemap: rollup.SourceMap | undefined): rollup.ExistingRawSourceMap | undefined {
	if (!sourcemap) return;
	return {...sourcemap};
}

function trimExtension(name: string) {
	return name.slice(0, name.length - path.extname(name).length)
}
