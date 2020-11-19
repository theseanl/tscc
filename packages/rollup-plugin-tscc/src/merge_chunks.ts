import * as rollup from 'rollup';
import MultiMap from './MultiMap';
import path = require('path');
import upath = require('upath');

export default async function mergeChunks(
	entry: string,
	chunkAllocation: MultiMap<string, string>,
	bundle: rollup.OutputBundle,
	globals?: {[id: string]: string}
) {
	return await new ChunkMerger(entry, chunkAllocation, bundle, globals).getBundleOutput();
}

// Merge chunks to their allocated entry chunk.
// For each entry module, create a facade module that re-exports everything from chunks
// allocated to it, and call rollup to create a merged bundle.
// Each chunk's export object is exported as a separate namespace, whose name is chosen
// so as not to collide with exported names of the entry module. We pass this namespace
// as rollup's global option in order to reference those from other chunks.
class ChunkMerger {
	private entryModuleNamespaces: Map<string, string>
	private chunkNamespaces: Map<string, string>
	private unresolveChunk: Map<string, string>;
	constructor(
		private entry: string,
		private chunkAllocation: MultiMap<string, string>,
		private bundle: Readonly<rollup.OutputBundle>,
		private globals?: {[id: string]: string}
	) { }
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
			for (let chunk of this.chunkAllocation.iterateValues(entry)) {
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
	private createFacadeModuleCode(): string {
		const importStmts: string[] = [];
		const exportStmts: string[] = [];
		// nodejs specification only allows posix-style path separators in module IDs.
		exportStmts.push(`export * from '${upath.toUnix(this.entry)}'`);
		for (let chunk of this.chunkAllocation.iterateValues(this.entry)) {
			if (chunk === this.entry) continue;
			let chunkNs = this.chunkNamespaces.get(chunk);
			importStmts.push(`import * as ${chunkNs} from '${upath.toUnix(chunk)}'`);
			exportStmts.push(`export { ${chunkNs} }`);
		}
		const facadeModuleCode = [...importStmts, ...exportStmts].join('\n');
		return facadeModuleCode;
	}
	private createLoaderPlugin(): rollup.Plugin {
		const {bundle} = this;
		const resolveId: rollup.ResolveIdHook = (id, importer) => {
			if (id === ChunkMerger.FACADE_MODULE_ID) return id;
			if (this.resolveGlobalForMainBuild(id)) {return {id, external: true}}
			if (this.chunkAllocation.find(this.entry, id)) return id;
			if (importer) {
				const resolved = path.resolve(path.dirname(importer), id);
				let unresolved = this.unresolveChunk.get(resolved);
				if (typeof unresolved === 'string') {
					let allocatedEntry = this.chunkAllocation.findValue(unresolved);
					if (allocatedEntry === this.entry) return unresolved;
					return {id: resolved, external: true}
				}
			}
			// This code path should not be taken
			throw new ChunkMergeError(`Unexpected module in output chunk: ${id}, ${importer}`);
		};
		const load: rollup.LoadHook = (id) => {
			if (id === ChunkMerger.FACADE_MODULE_ID) return this.createFacadeModuleCode();
			if (this.chunkAllocation.find(this.entry, id)) {
				let outputChunk = <rollup.OutputChunk>bundle[id];
				return {
					code: outputChunk.code,
					map: toInputSourceMap(outputChunk.map)
				}
			}
			// This code path should not be taken
			throw new ChunkMergeError(`Unexpected module in output chunk: ${id}`);
		};
		const name = "tscc-merger";
		return {name, resolveId, load};
	}
	private resolveGlobal(id: string) {
		if (this.resolveGlobalForMainBuild(id)) return this.globals[id];
		if (path.isAbsolute(id)) {
			id = this.unresolveChunk.get(id);
		}
		let allocated = this.chunkAllocation.findValue(id);
		if (allocated === undefined) throw new ChunkMergeError(`Unexpected module in output chunk: ${id}`);
		if (allocated === this.entry) return null; // not global
		// Resolve to <namespace-of-entry-module-that-our-chunk-is-allocated>.<namespace-of-our-chunk>
		let ns = this.entryModuleNamespaces.get(allocated);
		if (allocated !== id) ns += '.' + this.chunkNamespaces.get(id);
		return ns;
	}
	// TODO: inherit outputOption provided by the caller
	async getBundleOutput(): Promise<rollup.OutputChunk> {
		this.populateEntryModuleNamespaces();
		this.populateChunkNamespaces();
		this.populateUnresolveChunk();
		const myBundle = await rollup.rollup({
			input: ChunkMerger.FACADE_MODULE_ID,
			plugins: [this.createLoaderPlugin()]
		});
		const {output} = await myBundle.generate({
			name: this.entryModuleNamespaces.get(this.entry),
			format: 'iife',
			file: ChunkMerger.FACADE_MODULE_ID,
			globals: (id) => this.resolveGlobal(id),
			interop: "esModule",
			esModule: false,
			freeze: false
		});
		if (output.length > 1) {
			throw new ChunkMergeError("Subbundles should have only one output");
		}
		const mergedBundle = output[0];

		// 0. Fix fileName to that of entry file
		mergedBundle.fileName = this.entry;
		// 1. Remove facadeModuleId, as it would point to our virtual module
		mergedBundle.facadeModuleId = null;
		// 2. Fix name to that of entry file
		const name = (<rollup.OutputChunk>this.bundle[this.entry]).name;
		Object.defineProperty(mergedBundle, 'name', {
			get() {
				return name;
			}
		});
		// 3. Remove virtual module from .modules
		delete mergedBundle.modules[ChunkMerger.FACADE_MODULE_ID];

		return mergedBundle
	}
}

export class ChunkMergeError extends Error { }

/**
 * Converts SourceMap type used by OutputChunk type to ExistingRawSourceMap type used by load hooks.
 */
function toInputSourceMap(sourcemap: rollup.SourceMap): rollup.ExistingRawSourceMap {
	if (!sourcemap) return;
	return {...sourcemap};
}

