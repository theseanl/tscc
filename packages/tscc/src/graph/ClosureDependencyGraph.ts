import {FSCacheAccessor} from './Cache';
import {ISourceNode} from './ISourceNode';
import {sourceNodeFactoryFromContent, ClosureSourceError} from './source_node_factory';
import {INamedModuleSpecsWithId} from '@tscc/tscc-spec'
import {flatten, riffle} from '../shared/array_utils'

// To be used as arguments of DepsSorter#getDeps
export interface IEntryPoint {
	readonly moduleId: string | null,
	readonly extraSources: ReadonlyArray<string> // Array of file names for extra sources.
}

export default class ClosureDependencyGraph {
	async addSourceByFileNames(fileNames: string[], fsCacheAccessor: FSCacheAccessor<ISourceNode>) {
		await Promise.all(fileNames.map(async (fileName) => {
			try {
				this.addSourceNode(await fsCacheAccessor.getFileData(fileName));
			} catch (e) {
				if (e instanceof ClosureSourceError && !e.fatal) {
					// pass
				} else throw e;
			}
		}));
	}
	addSourceByContent(fileName: string, content: string) {
		try {
			this.addSourceNode(sourceNodeFactoryFromContent(fileName, content));
		} catch (e) {
			if (e instanceof ClosureSourceError && !e.fatal) {
				// pass
			} else throw e;
		}
	}
	private addSourceNode(sourceNode: ISourceNode) {
		// Raise error on duplicate module names.
		for (let provided of sourceNode.provides) {
			if (this.moduleNameToNode.has(provided)) {
				throw new ClosureDepsError(`Duplicate provides for ${provided}`);
			}
		}
		for (let provided of sourceNode.provides) {
			this.moduleNameToNode.set(provided, sourceNode);
		}
		this.fileNameToNode.set(sourceNode.fileName, sourceNode);
	}

	private fileNameToNode: Map<string, ISourceNode> = new Map();
	private moduleNameToNode: Map<string, ISourceNode> = new Map();

	hasModule(moduleName: string): boolean {
		return this.moduleNameToNode.has(moduleName);
	}

	/**
	 * Start walker
	 */
	private forwardDeclared: Set<ISourceNode> = new Set();
	private required: Set<ISourceNode> = new Set();
	clear() {
		this.forwardDeclared.clear();
		this.required.clear();
	}
	private getSourceNode(moduleName: string) {
		let sourceNode = this.moduleNameToNode.get(moduleName);

		if (!sourceNode) {
			throw new ClosureDepsError(
				`Module name ${moduleName} was not provided as a closure compilation source`
			);
		} else {
			return sourceNode;
		}
	}
	// Walks the graph, marking type-required nodes and required nodes
	// (with DepsSorter#forwardDeclared, DepsSorter#required Sets)
	// required-marker has precedence over type-required-marker.
	private *getReferencedNode(node: string | ISourceNode): IterableIterator<ISourceNode> {
		if (typeof node === 'string') {
			node = this.getSourceNode(node);
		}

		if (this.forwardDeclared.has(node)) {
			this.forwardDeclared.delete(node);
		}
		if (this.required.has(node)) {
			return;
		}
		this.required.add(node);

		yield node;

		for (let forwardDeclared of node.forwardDeclared) {
			let fwdNode = this.getSourceNode(forwardDeclared);
			if (!this.required.has(fwdNode)) {
				this.forwardDeclared.add(fwdNode);
			}
		}

		for (let required of node.required) {
			let reqNode = this.getSourceNode(required);
			yield* this.getReferencedNode(reqNode);
		}
	}
	private static getFileName(sourceNode: ISourceNode) {
		return sourceNode.fileName;
	}
	getSortedFilesAndFlags(entryPoints: INamedModuleSpecsWithId[]): {src: string[], flags: string[]} {
		let sortedFileNames = entryPoints.map(entryPoint => {
			let deps: string[];
			if (entryPoint.moduleId === null) {
				// For empty chunks included to allow code motion moving into it
				deps = [];
			} else {
				deps = [...this.getReferencedNode(entryPoint.moduleId)].map(ClosureDependencyGraph.getFileName);
			}
			if (entryPoint.extraSources) {
				deps.push(...entryPoint.extraSources);
			}
			return deps;
		});

		let forwardDeclaredFileNames = [...this.forwardDeclared].map(ClosureDependencyGraph.getFileName);
		// prepend modules which are only forwardDeclare'd to the very first module.
		sortedFileNames[0] = [...forwardDeclaredFileNames, ...sortedFileNames[0]];
		const flags = entryPoints.length === 1 ?
			// single chunk build uses --js_output_file instead of --chunk, which is set in tsccspecwithts.
			// when --chunk is used, closure compiler generates $weak$.js chunks.
			[] :
			riffle("--chunk", sortedFileNames.map((depsOfAModule, index) => {
				let entryPoint = entryPoints[index];
				const args: (string | number)[] = [entryPoint.moduleName, depsOfAModule.length];
				if (index !== 0) {
					// Do not specify dependencies for the very first (root) chunk.
					args.push(...entryPoint.dependencies);
				}
				return args.join(':');
			}));

		return {src: flatten(sortedFileNames), flags}
	}
}

export class ClosureDepsError extends Error {};

