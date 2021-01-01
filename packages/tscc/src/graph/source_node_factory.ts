import {ISourceNode} from './ISourceNode';
import fs = require('fs');
import readline = require('readline');

/**
 * Uses fast regex search instead of parsing AST, as done in
 * https://github.com/google/closure-library/blob/master/closure/bin/build/source.py
 */
export async function sourceNodeFactory(closureSourcePath: string): Promise<ISourceNode> {
	const rl = readline.createInterface({
		input: fs.createReadStream(closureSourcePath),
		crlfDelay: Infinity
	});
	const parser = new ClosureSourceLineParser(closureSourcePath);
	for await (const line of rl) {
		if (parser.consumeLine(line)) break;
	}
	return parser.getSourceNode();
}

export function sourceNodeFactoryFromContent(fileName: string, content: string): ISourceNode {
	const lines = content.split('\n');
	const parser = new ClosureSourceLineParser(fileName);
	for (const line of lines) {
		if (parser.consumeLine(line)) break;
	}
	return parser.getSourceNode();
}

class ClosureSourceLineParser {
	private isInComment = false;
	private moduleSymbol: string | undefined;
	private providedSymbols = new Set<string>();
	private requiredSymbols = new Set<string>();
	private forwardDeclaredSymbols = new Set<string>();
	constructor(
		private closureSourcePath: string
	) {}
	// Looking for top-level goog.require,provide,module,forwardDeclare,requireType calls on each line.
	// Tsickle now emits goog.requireType instead of forwardDeclare as of Feb 3 2019.
	// Returns truthy value when no more line needs to be consumed.
	consumeLine(line: string) {
		// Heuristic for searching provideGoog in comments
		if (!this.isInComment && reStartPureComment.test(line)) this.isInComment = true;
		if (this.isInComment) {
			if (reProvideGoog.test(line)) {
				this.providedSymbols.add('goog');
				return true;
			}
			if (reEndComment.test(line)) this.isInComment = false;
		}

		if (reGoogModule.exec(line)) {
			if (this.moduleSymbol) {
				throw new ClosureSourceError(`Duplicate module symbols in ${this.closureSourcePath}`);
			}
			this.moduleSymbol = RegExp.$1;
		} else if (reGoogProvide.exec(line)) {
			this.providedSymbols.add(RegExp.$1);
		} else if (reGoogRequire.exec(line)) {
			this.requiredSymbols.add(RegExp.$1);
		} else if (reGoogForwardDeclare.exec(line)) {
			this.forwardDeclaredSymbols.add(RegExp.$1);
		} else if (reGoogRequireType.exec(line)) {
			this.forwardDeclaredSymbols.add(RegExp.$1);
		}
	}
	getSourceNode(): ISourceNode {
		if (this.moduleSymbol && this.providedSymbols.size) {
			throw new ClosureSourceError(
				`goog.provide call in goog module ${this.closureSourcePath}`
			);
		}
		if (!this.moduleSymbol && this.providedSymbols.size === 0) {
			// Such files can occur naturally while providing bulk of files via glob
			throw new ClosureSourceError(
				`File ${this.closureSourcePath} is not a goog module nor provides anything.`,
				false /* not harmful */
			);
		}
		return {
			fileName: this.closureSourcePath,
			provides: this.moduleSymbol ? [this.moduleSymbol] : [...this.providedSymbols],
			// goog is implicitly required by every module
			required: this.providedSymbols.has('goog') ? [] : ['goog', ...this.requiredSymbols],
			forwardDeclared: [...this.forwardDeclaredSymbols]
		}
	}
}

function toGoogPrimitiveRegex(name: string, assignment: boolean = false) {
	let src = `goog\\.${name}\\(['"](.*)['"]\\)`
	if (assignment) {
		src = `(?:(?:var|let|const)\\s+[a-zA-Z0-9$_,:\\{\\}\\s]*\\s*=\\s*)?` + src;
	}
	return new RegExp(`^\\s*` + src);
}

const reGoogProvide = toGoogPrimitiveRegex('provide');
const reGoogModule = toGoogPrimitiveRegex('module');
const reGoogRequire = toGoogPrimitiveRegex('require', true);
const reGoogForwardDeclare = toGoogPrimitiveRegex('forwardDeclared', true);
const reGoogRequireType = toGoogPrimitiveRegex('requireType', true);
// base.js of closure library goog.provide's "goog", even though it's not declared in it,
// and is implicitly required by any module/library that access "goog" namespace.
// Such a file is marked by /** @provideGoog */ comment.
const reProvideGoog = /@provideGoog/;
const reStartPureComment = /^\s*\/\*\*/;
const reEndComment = /\*\//;

export class ClosureSourceError extends Error {
	constructor(msg: string, public fatal = true) {
		super(msg);
	}
}

