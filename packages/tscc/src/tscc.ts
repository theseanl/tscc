import {IInputTsccSpecJSON} from '@tscc/tscc-spec';
import * as StreamArray from 'stream-json/streamers/StreamArray';
import * as tsickle from "tsickle";
import * as ts from "typescript";
import getDefaultLibs from './default_libs';
import {Cache, FSCacheAccessor} from './graph/Cache';
import ClosureDependencyGraph from './graph/ClosureDependencyGraph';
import {ISourceNode} from './graph/ISourceNode';
import {sourceNodeFactory} from './graph/source_node_factory';
import Logger from './log/Logger';
import * as spinner from './log/spinner';
import {applyPatches, restorePatches} from './tsickle_patches/facade'
import {getPackageBoundary} from './tsickle_patches/patch_tsickle_module_resolver';
import {riffle} from './shared/array_utils';
import PartialMap from './shared/PartialMap';
import {ClosureJsonToVinyl, IClosureCompilerInputJson, RemoveTempGlobalAssignments} from './shared/vinyl_utils';
import spawnCompiler from './spawn_compiler';
import ITsccSpecWithTS from "./spec/ITsccSpecWithTS";
import TsccSpecWithTS, {TsError} from "./spec/TsccSpecWithTS";
import decoratorPropertyTransformer from './transformer/decoratorPropertyTransformer';
import restPropertyTransformer from './transformer/restPropertyTransformer';
import {getExternsForExternalModules, getGluingModules} from './external_module_support';
import fs = require('fs');
import path = require('path');
import stream = require('stream');
import fsExtra = require('fs-extra');
import vfs = require('vinyl-fs');
import upath = require('upath');
import chalk = require('chalk');

export const TEMP_DIR = ".tscc_temp";

/**
 * If the first argument is a string, it will try to lookup tscc.spec.json with the following priority:
 *  - The path itself
 *  - Files named tscc.spec.json or tscc.spec.js in a directory, regarding the path as a directory
 * If it is an object, it will treated as a JSON format object of the spec from a file located in
 * the current working directory. If no argument was passed, it will lookup the spec file on the
 * current working directory.
 * The second argument indicates the path to the tsconfig.json file.
 * The third argument is what would you put in tsconfig.json's compilerOptions. Options specified there
 * will override those of tsconfig.json.
 */
export default async function tscc(
	tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON,
	tsConfigPathOrTsArgs?: string,
	compilerOptionsOverride?: object
): Promise<void>
/** @internal */
export default async function tscc(
	tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON,
	tsConfigPathOrTsArgs: string[],
	compilerOptionsOverride?: object
): Promise<void>
/** @internal */
export default async function tscc(
	tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON,
	tsConfigPathOrTsArgs?: string | string[],
	compilerOptionsOverride?: object
): Promise<void> {
	const tsccLogger = new Logger(chalk.green("TSCC: "), process.stderr);
	const tsLogger = new Logger(chalk.blue("TS: "), process.stderr);

	const tsccSpec = TsccSpecWithTS.loadSpecWithTS(
		tsccSpecJSONOrItsPath,
		tsConfigPathOrTsArgs,
		compilerOptionsOverride,
		(msg: string) => {tsccLogger.log(msg)}
	);

	const program = ts.createProgram(
		[...tsccSpec.getAbsoluteFileNamesSet()],
		tsccSpec.getCompilerOptions(),
		tsccSpec.getCompilerHost()
	);
	const diagnostics = ts.getPreEmitDiagnostics(program);
	if (diagnostics.length) throw new TsError(diagnostics);

	const transformerHost = getTsickleHost(tsccSpec, tsLogger);

	/**
	 * Ideally, the dependency graph should be determined from ts sourceFiles, and the compiler
	 * process can be spawned asynchronously before calling tsickle.
	 * Then, we will be able to set `tsickleHost.shouldSkipTsickleProcessing` and the order of
	 * files that are transpiled by tsickle. This has an advantage in that we can stream JSONs
	 * in order that they came out from tsickle, cuz Closure compiler requires JSON files to be
	 * sorted exactly as how js files would be sorted.
	 *
	 * As I recall, it was unsafe to use ModuleManifest returned from tsickle, cuz it does
	 * not include forwardDeclares or something.
	 * For now, we are computing the graph from the tsickle output in order to reuse
	 * codes from closure-tools-helper.
	 */
	const closureDepsGraph = new ClosureDependencyGraph();
	if (tsccSpec.getJsFiles().length) {
		const jsFileCache = new Cache<ISourceNode>(path.join(TEMP_DIR, "jscache.json"));
		const fileAccessor = new FSCacheAccessor<ISourceNode>(jsFileCache, sourceNodeFactory);
		// async operation
		await closureDepsGraph.addSourceByFileNames(tsccSpec.getJsFiles(), fileAccessor);
	}

	const tsickleOutput: PartialMap<string, IClosureCompilerInputJson> = new PartialMap();

	const {writeFile, writeExterns, externPath} =
		getWriteFileImpl(tsccSpec, tsickleOutput, closureDepsGraph);

	const stdInStream = new stream.Readable({read: function () {}});
	const pushImmediately = (arg: string) => setImmediate(pushToStream, stdInStream, arg);

	// ----- start tsickle call -----
	pushImmediately("[")

	// Manually push tslib, goog(base.js), goog.reflect, which are required in compilation
	const defaultLibsProvider = getDefaultLibs(tsccSpec.getTSRoot());
	defaultLibsProvider.libs.forEach(({path, id}) => {
		// ..only when user-provided sources do not provide such modules
		if (closureDepsGraph.hasModule(id)) return;
		writeFile(path, fs.readFileSync(path, 'utf8'))
	})

	// Manually push gluing modules
	getGluingModules(tsccSpec, transformerHost).forEach(({path, content}) => {
		writeFile(path, content)
	})

	let result: tsickle.EmitResult;
	try {
		applyPatches();
		result = tsickle.emit(program, transformerHost, writeFile, undefined, undefined, false, {
			afterTs: [
				decoratorPropertyTransformer(transformerHost),
				restPropertyTransformer(transformerHost)
			]
		});
	} finally {
		restorePatches(); // Make sure that our patches are removed even if tsickle.emit throws.
	}

	// If tsickle errors, print diagnostics and exit.
	if (result.diagnostics.length) throw new TsError(result.diagnostics);

	const {src, flags} = closureDepsGraph.getSortedFilesAndFlags(
		tsccSpec.getOrderedModuleSpecs().map(entry => ({
			moduleId: transformerHost.pathToModuleName('', entry.entry),
			...entry
		}))
	);

	pushTsickleOutputToStream(src, tsccSpec, tsickleOutput, stdInStream, tsccLogger);

	// Write externs to a temp file.
	// ..only after attaching tscc's generated externs
	const externs = tsickle.getGeneratedExterns(result.externs, '') +
		getExternsForExternalModules(tsccSpec, transformerHost);
	writeExterns(externs);

	pushImmediately("]");
	pushImmediately(null);
	/// ----- end tsickle call -----

	return new Promise((resolve, reject) => {
		/**
		 * Spawn compiler process with module dependency information
		 */
		const ccLogger = new Logger(chalk.redBright("ClosureCompiler: "), process.stderr);
		spinner.startTask("Closure Compiler");

		const compilerProcess = spawnCompiler([
			...tsccSpec.getBaseCompilerFlags(),
			...flags,
			'--json_streams', "BOTH",
			'--externs', externPath,
			...riffle('--externs', defaultLibsProvider.externs)
		], ccLogger, onCompilerProcessClose, tsccSpec.debug().persistArtifacts);

		// Checks whether the compiler process streamed any data to stdout.
		// If not, the end of process is the end of the compilation, no 'end' emit
		// event will be fired from above streams.
		let compilerProcessStreamedAnyData = false;
		compilerProcess.stdout.on('data', () => {compilerProcessStreamedAnyData = true;})

		function onCompilerProcessClose(code) {
			if (code === 0) {
				spinner.succeed();
				spinner.unstick();
				tsccLogger.log(`Compilation success.`)
				if (tsccSpec.debug().persistArtifacts) {
					tsccLogger.log(tsccSpec.getOutputFileNames().join('\n'));
				}
				if (!compilerProcessStreamedAnyData) resolve();
			} else {
				spinner.fail(`Closure compiler error`);
				spinner.unstick();
				ccLogger.log(`Exited with code ${code}.`);
				reject(new CcError(String(code)));
			}
		};

		stdInStream
			.pipe(compilerProcess.stdin);

		// Use gulp-style transform streams to post-process cc output - see shared/vinyl_utils.ts.
		// TODO support returning gulp stream directly
		const useSourceMap: boolean = tsccSpec.getCompilerOptions().sourceMap;
		compilerProcess.stdout
			.pipe(StreamArray.withParser())
			.pipe(new ClosureJsonToVinyl(useSourceMap, tsccLogger))
			.pipe(new RemoveTempGlobalAssignments(tsccLogger))
			.pipe(vfs.dest('.', {sourcemaps: '.'})) // Can we remove dependency on vinyl-fs?
			.on('end', resolve);

	});
}

export class CcError extends Error {}

/**
 * Remove `//# sourceMappingURL=...` from source TS output which typescript generates when
 * sourceMap is enabled. Closure Compiler does not recognize attached sourcemaps in Vinyl
 * if this comment is present.
 * TODO if closure is actually looking for sourcemaps within that url, check that if we can provide
 * sourcemap in such a way that closure can find it, and remove this workaround.
 */
function removeSourceMappingUrl(tsOutput: string): string {
	return tsOutput.replace(reSourceMappingURL, '');
}
const reSourceMappingURL = /^\/\/[#@]\s*sourceMappingURL\s*=\s*.*?\s*$/mi;

function getWriteFileImpl(spec: ITsccSpecWithTS, tsickleVinylOutput: PartialMap<string, IClosureCompilerInputJson>, closureDepsGraph: ClosureDependencyGraph) {
	const tempFileDir = path.join(process.cwd(), TEMP_DIR, spec.getProjectHash());
	fsExtra.mkdirpSync(tempFileDir);
	// Closure compiler produces an error if output file's name is the same as one of
	// input files, which are in this case .js files. However, if such a file is an intermediate file
	// generated by TS, it is a legitimate usage. So we make file paths coming from TS virtual by
	// appending '.tsickle' to it.
	// See GH issue #82: When Windows-style path is used as a 'path' property of input, the Compiler
	// does not recognize path separators and fails to resolve paths in sourcemaps. Hence we replace
	// paths to unix-style paths just before we add it to input JSON object.
	const toVirtualPath = (filePath: string) => {
		if (tsOutputs.includes(filePath)) filePath += '.tsickle';
		let relPath = path.relative(spec.getTSRoot(), filePath);
		if (process.platform === 'win32') {
			// Convert to unix-style path only on Windows; on Unix, Windows-style path separator
			// is a valid directory/file name.
			relPath = upath.normalize(relPath);
		}
		return relPath;
	};
	const tsOutputs = [...spec.getAbsoluteFileNamesSet()].map(fileName => {
		let ext = path.extname(fileName);
		return fileName.slice(0, -ext.length) + '.js';
	});
	const writeFile = (filePath: string, contents: string) => {
		// Typescript calls writeFile with not normalized path. 'spec.getAbsoluteFileNamesSet' returns
		// normalized paths. Fixes GH issue #81.
		filePath = path.normalize(filePath);
		// Typescript calls writeFileCallback with absolute path.
		// On the contrary, "file" property of sourcemaps are relative path from ts project root.
		// For consistency, we convert absolute paths here to path relative to ts project root.
		if (spec.debug().persistArtifacts) {
			// filePath may contain colons which are not allowed in the middle of a path
			// such colons are a part of 'root', we are merely stripping it out.
			let filePathMinusRoot = filePath.substring(path.parse(filePath).root.length);
			fsExtra.outputFileSync(path.join(tempFileDir, filePathMinusRoot), contents);
		}
		switch (path.extname(filePath)) {
			case '.js': {
				if (spec.getCompilerOptions().sourceMap) {
					contents = removeSourceMappingUrl(contents)
				}
				closureDepsGraph.addSourceByContent(filePath, contents);
				tsickleVinylOutput.set(filePath, {
					src: contents,
					path: toVirtualPath(filePath)
				})
				return;
			}
			case '.map': {
				let sourceFilePath = filePath.slice(0, -4);
				tsickleVinylOutput.set(sourceFilePath, {
					sourceMap: contents
				})
				return;
			}
			default:
				throw new Error(`Unrecognized file extension ${filePath}.`)
		}
	}

	const writeExterns = (contents: string) => {
		fs.writeFileSync(externPath, contents);
	}
	const externPath = path.join(tempFileDir, "externs_generated.js");
	return {writeFile, writeExterns, externPath}
}

function pushToStream(stream: stream.Readable, ...args: string[]) {
	for (let arg of args) stream.push(arg);
}

function pushTsickleOutputToStream(
	src: ReadonlyArray<string>, // file names, ordered to be pushed to compiler sequentially
	tsccSpec: ITsccSpecWithTS,
	tsickleVinylOutput: PartialMap<string, IClosureCompilerInputJson>,
	stdInStream: stream.Readable,
	logger: Logger
) {
	let isFirstFile = true;
	const pushToStdInStream = (...args: string[]) => {
		pushToStream(stdInStream, ...args);
	};
	const pushVinylToStdInStream = (json: IClosureCompilerInputJson) => {
		if (isFirstFile) isFirstFile = false;
		else pushToStdInStream(",");
		pushToStdInStream(JSON.stringify(json));
	}
	if (tsccSpec.debug().persistArtifacts) {
		logger.log(`File orders:`);
		src.forEach(sr => logger.log(sr));
	}
	setImmediate(() => {
		src.forEach(name => {
			let out = <IClosureCompilerInputJson>tsickleVinylOutput.get(name);
			if (!out) {
				logger.log(`File not emitted from tsickle: ${name}`);
			} else {
				pushVinylToStdInStream(out);
			}
		})
	});
}

function getTsickleHost(tsccSpec: ITsccSpecWithTS, logger: Logger): tsickle.TsickleHost {
	const options = tsccSpec.getCompilerOptions();
	const compilerHost = tsccSpec.getCompilerHost();

	// Non-absolute file names are resolved from the TS project root.
	const fileNamesSet = tsccSpec.getAbsoluteFileNamesSet();

	const externalModuleNames = tsccSpec.getExternalModuleNames();
	const resolvedExternalModuleTypeRefs: string[] = [];

	for (let name of externalModuleNames) {
		let typeRefFileName = tsccSpec.resolveExternalModuleTypeReference(name);
		if (typeRefFileName) {
			resolvedExternalModuleTypeRefs.push(typeRefFileName);
		}
	}

	const externalModuleRoots = resolvedExternalModuleTypeRefs
		.map(getPackageBoundary);

	const ignoreWarningsPath = tsccSpec.debug().ignoreWarningsPath || ["/node_modules/"];

	const transformerHost: tsickle.TsickleHost = {
		shouldSkipTsickleProcessing(fileName: string) {
			const absFileName = path.resolve(fileName);
			if (fileNamesSet.has(absFileName)) return false;
			// .d.ts files in node_modules for external modules are needed to generate
			// externs file.
			if (externalModuleRoots.findIndex(root => absFileName.startsWith(root)) !== -1) {
				return false;
			}
			return true;
		},
		shouldIgnoreWarningsForPath(fileName: string) {
			return true; // Just a stub, maybe add configuration later.
			// controls whether a warning will cause compilation failure.
		},
		// This affects, for example, usage of const in const mod = goog.require('..').
		es5Mode: options.target === undefined || options.target === ts.ScriptTarget.ES3 || options.target === ts.ScriptTarget.ES5,
		googmodule: true,
		transformDecorators: true,
		transformTypesToClosure: true,
		typeBlackListPaths: new Set(),
		untyped: false,
		logWarning(warning) {
			if (warning.file) {
				let {fileName} = warning.file;
				for (let i = 0, l = ignoreWarningsPath.length; i < l; i++) {
					if (fileName.indexOf(ignoreWarningsPath[i]) !== -1) return;
				}
			}
			logger.log(ts.formatDiagnostic(warning, compilerHost));
		},
		options,
		/**
		 * Supports import from './dir' that resolves to './dir/index.ts'
		 */
		convertIndexImportShorthand: true,
		moduleResolutionHost: compilerHost,
		fileNameToModuleId: (fileName) => path.relative(process.cwd(), fileName),
		/**
		 * Unlike the default function that tsickle uses, here we are actually resolving
		 * the imported name with typescript's API. This is safer for consumers may use
		 * custom path mapping using "baseUrl", "paths" , but at the cost of relinquishing
		 * deterministic output based on a single file.
		 */
		pathToModuleName: (context: string, fileName: string) => {
			// Module names specified as external are not resolved, which in effect cause
			// googmodule transformer to emit module names verbatim in `goog.require()`.
			if (externalModuleNames.includes(fileName)) return fileName;
			// 'tslib' is always considered as an external module.
			if (fileName === 'tslib') return fileName;
			// Resolve module via ts API
			const resolved = ts.resolveModuleName(fileName, context, options, compilerHost);
			if (resolved && resolved.resolvedModule) {
				fileName = resolved.resolvedModule.resolvedFileName;
			}
			// resolve relative to the ts project root.
			fileName = path.relative(tsccSpec.getTSRoot(), fileName);
			return convertToGoogModuleAdmissibleName(fileName);
		}
	}

	return transformerHost;
}

/**
 * A valid goog.module name must start with [a-zA-Z_$] end only contain [a-zA-Z0-9._$].
 * Maps path separators to ".",
 */
function convertToGoogModuleAdmissibleName(modulePath: string): string {
	return modulePath
		.replace(/\.[tj]sx?$/, '') //remove file extension
		.replace(/[\/\\]/g, '.')
		.replace(/^[^a-zA-Z_$]/, '_')
		.replace(/[^a-zA-Z0-9._$]/g, '_');
}

