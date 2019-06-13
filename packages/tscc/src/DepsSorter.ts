/**
 * @fileoverview Contains a class that can be used to retreive dependencies information to be used
 * for `--module` options in closure compiler.
 *
 * This is made to work with tsickle output, i.e. only works with `goog.module` and `goog.require`.
 */

import path = require('path');
import fsExtra = require('fs-extra');
import esprima = require('esprima');
import estraverse = require('estraverse');
import fg = require('fast-glob')
import {flatten} from './array_utils';


interface ISourceNode {
	readonly fileName: string
	readonly provides: string[]
	readonly requiredIter: IterableIterator<string>
	readonly forwardDeclaredIter: IterableIterator<string>
}

/**
 * TODO: change this to use simple Regex searches for performance
 */
class SourceNode implements ISourceNode {
	constructor(
		public fileName: string
	) {}

	public provides: string[] = [];

	private required: Set<string> = new Set();
	private forwardDeclared: Set<string> = new Set();

	/**
	 * Resolves the fileName via the node's default require.resolve function.
	 */
	private static async defaultFileReader(fileName: string) {
		if (!fileName.startsWith('.')) fileName = require.resolve(fileName)
		return (await require('fs-extra').readFile(fileName)).toString();
	}
	public async populateDeps(
		asyncFileReader: (fileName: string) => Promise<string> = SourceNode.defaultFileReader
	): Promise<this> {
		this.populateDepsFromFileContent(await asyncFileReader(this.fileName));
		return this;
	}
	public populateDepsSync(content: string): this {
		this.populateDepsFromFileContent(content);
		return this;
	}
	private populateDepsFromFileContent(content: string) {
		const ast = esprima.parse(content);
		// Lookup top-level `goog.require` and `goog.forwardDeclare` calls, populate `required`, `forwardDeclared` Sets.
		estraverse.traverse(ast, {enter: this.onSourceAstNode.bind(this)});
		if (this.provides.length === 0) this.notAGoogModuleError();
	}
	private onSourceAstNode(this: this, node) {
		switch (node.type) {
			case "BlockStatement":
				// Only top-levels
				return estraverse.VisitorOption.Skip;
			case "CallExpression":
				if (node.callee.type === "MemberExpression") {
					let callee = node.callee;
					if (callee.object.name === 'goog') {
						if (!node.arguments[0]) {return;}
						let moduleName = node.arguments[0].value;
						switch (callee.property.name) {
							case 'require': {
								if (this.forwardDeclared.has(moduleName)) {
									this.forwardDeclared.delete(moduleName);
								}
								this.required.add(moduleName);
								break;
							}
							// Tsickle now emits goog.requireType instead of forwardDeclare
							// as of Feb 3 2019.
							case 'requireType':
							case 'forwardDeclare': {
								if (!this.required.has(moduleName)) {
									this.forwardDeclared.add(moduleName);
								}
								break;
							}
							case 'module':
							case 'provide': {
								this.provides.push(moduleName);
								break;
							}
						}
					}
				}
		}
	}
	private notAGoogModuleError(): never {
		throw new SourceError(`${this.fileName} is not a goog.module nor goog.provide's anything.`);
	}
	// Read-only iterators
	get requiredIter() {
		return this.required.values();
	}
	get forwardDeclaredIter() {
		return this.forwardDeclared.values();
	}
}

class SourceError extends Error {}

interface IClosureDepsJSON {
	[fileName: string]: {
		provides: string[]
		requires: string[]
		forwardDeclares: string[]
	}
}

export interface IEntryPoint {
	readonly moduleId: string | null,
	readonly extraSources: ReadonlyArray<string> // Array of file names for extra sources.
}

export default class DepsSorter {

	private addSourceNode(sourceNode: ISourceNode) {
		this.fileNameToNode.set(sourceNode.fileName, sourceNode);
		for (let provided of sourceNode.provides) {
			this.moduleNameToNode.set(provided, sourceNode);
		}
	}

	private static CLOSURE_LIBRARY_DEPS_PATH = path.resolve(__dirname, './closure_library_deps.json');
    /**
     * Loads closure library dependency information from `closure_library_deps.json`,
     * to avoid reading and parsing all the closure library files every time.
     */
	private fromClosureDeps() {
		const json: IClosureDepsJSON = fsExtra.readJSONSync(DepsSorter.CLOSURE_LIBRARY_DEPS_PATH);

		for (let fileName in json) {
			if (json.hasOwnProperty(fileName)) {
				let data = json[fileName];

				this.addSourceNode({
					fileName,
					provides: data.provides,
					requiredIter: new Set(data.requires).values(),
					forwardDeclaredIter: new Set(data.forwardDeclares).values()
				});
			}
		}
	}

	public static async distillClosureDeps() {
		const sorter = new DepsSorter();

		const closureLibraryFileNames: string[] = await expandGlobInNodeModules([
			'closure/goog/**/*.js',
			'third_party/closure/goog/**/*.js',
			'!**/*_test.js'
		], 'google-closure-library');
		console.log(closureLibraryFileNames.join('\n'))
		sorter.addSourceByFileNames(closureLibraryFileNames);

		const json: IClosureDepsJSON = {};
		// For closure library, `base.js` is required even if it does not `provide`s anything.
		// we register a hypothetical module name `goog._base` and add it to every module.
		for (let [fileName, node] of sorter.fileNameToNode) {
			json[fileName] = {
				provides: node.provides,
				requires: ['goog._base', ...node.requiredIter],
				forwardDeclares: [...node.forwardDeclaredIter]
			};
		}
		json['google-closure-library/closure/goog/base.js'] = {
			provides: ['goog._base'],
			requires: [],
			forwardDeclares: []
		};

		await fsExtra.writeJSON(DepsSorter.CLOSURE_LIBRARY_DEPS_PATH, json);
	}

	private fileNameToNode: Map<string, ISourceNode> = new Map();
	private moduleNameToNode: Map<string, ISourceNode> = new Map();

	private getFileName(moduleName: string): string {
		let node = this.moduleNameToNode.get(moduleName);
		if (!node) {
			// console.log(`node does not exist for a moduleName ${moduleName}`);
			return;
		}
		return node.fileName;
	}

	private forwardDeclared: Set<ISourceNode> = new Set();
	private required: Set<ISourceNode> = new Set();

	private getSourceNode(moduleName: string) {
		let sourceNode = this.moduleNameToNode.get(moduleName);

		if (!sourceNode) {
			throw new SourceError(`Module name ${moduleName} was not provided in source glob`);
		} else {
			return sourceNode;
		}
	}

	private *getReferencedNode(node: string | ISourceNode): IterableIterator<ISourceNode> {
		if (typeof node === 'string') {node = this.getSourceNode(node);}

		yield node;

		for (let forwardDeclared of node.forwardDeclaredIter) {
			let fwdNode = this.getSourceNode(forwardDeclared);
			if (!this.required.has(fwdNode)) {
				this.forwardDeclared.add(fwdNode);
			}
		}

		for (let required of node.requiredIter) {
			let reqNode = this.getSourceNode(required);
			if (this.forwardDeclared.has(reqNode)) {
				this.forwardDeclared.delete(reqNode);
			}
			if (this.required.has(reqNode)) {
				continue;
			}
			this.required.add(reqNode);

			yield* this.getReferencedNode(reqNode);
		}
	}
	addClosureDeps() {
		this.fromClosureDeps();
	}
	async addSourceByFileNames(fileNames: string[]) {
		await Promise.all(fileNames.map(async (fileName) => {
			try {
				this.addSourceNode(await new SourceNode(fileName).populateDeps());
			} catch (e) {
				if (!(e instanceof SourceError)) throw e;
				// console.log(`Skipping ${fileName}, for ${e.toString()}`);
			}
		}));
	}
	addSourceByContent(fileName: string, content: string) {
		try {
			this.addSourceNode(new SourceNode(fileName).populateDepsSync(content));
		} catch (e) {
			if (!(e instanceof SourceError)) throw e;
			// console.log(`Skipping ${fileName}, for ${e.toString()}`);
		}
	}

	private static getFileName(sourceNode: ISourceNode) {
		return sourceNode.fileName;
	}
	getDeps(entryPoints: IEntryPoint[]): string[][] {
		let out = entryPoints.map(entryPoint => {
			let deps: string[];
			if (entryPoint.moduleId === null) {
				deps = [];
			} else {
				deps = [...this.getReferencedNode(entryPoint.moduleId)].map(DepsSorter.getFileName);
			}
			deps.push(...entryPoint.extraSources);
			return deps;
		});

		let forwardDeclaredFileNames = [...this.forwardDeclared].map(DepsSorter.getFileName);

		// prepend modules which are only forwardDeclare'd to the very first module.
		out[0] = [...forwardDeclaredFileNames, ...out[0]];
		return out;
	}
}

/**
 * Replaces root dir to a resolved module path. Different from require.resolve
 * in that it only cares about the existence of a module, not the actual file.
 */
async function expandGlobInNodeModules(p: string | string[], moduleName: string): Promise<string[]> {
	// Resolving a directory of ${base} module. If filename is not specified, 
	// node will resolve it wrt package.json's "main" value, hence we attach 
	// package.json which should exist for any node module.
	const resolvedModulePath = path.dirname(require.resolve(path.join(moduleName, 'package.json')))
	const paths: string[] = await fg(p, {cwd: resolvedModulePath});
	return paths.map(name => path.join(moduleName, name));
}

