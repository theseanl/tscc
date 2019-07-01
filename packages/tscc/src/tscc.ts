import * as ts from "typescript"
import * as tsickle from "tsickle";
import TsccSpecWithTS, {TsError} from "./spec/TsccSpecWithTS";
import ITsccSpecWithTS from "./spec/ITsccSpecWithTS";
import fs = require('fs');
import path = require('path');
import stream = require('stream');
import fsExtra = require('fs-extra');
import chalk from 'chalk';
import {IInputTsccSpecJSON} from '@tscc/tscc-spec'
import {Cache, FSCacheAccessor} from './graph/Cache'
import {ISourceNode} from './graph/ISourceNode';
import {sourceNodeFactory} from './graph/source_node_factory'
import ClosureDependencyGraph from './graph/ClosureDependencyGraph';
import externalModuleTransformer, {getExternsForExternalModules} from './transformer/externalModuleTransformer'
import decoratorPropertyTransformer from './transformer/decoratorPropertyTransformer'
import {registerTypeBlacklistedModuleName, patchTypeTranslator} from './blacklist_symbol_type';
import Logger from './log/Logger';
import {removeCcExport} from './remove_cc_export';


export const TEMP_DIR = ".tscc_temp";

/**
 * If the first argument is a string, it will try to lookup tscc.spec.json with the following priority:
 *  - The path itself
 *  - Files named tscc.spec.json or tscc.spec.js in a directory, regarding the path as a directory
 * If it is an object, it will treated as a JSON format object of the spec from a file located in
 * the current working directory. If no argument was passed, it will lookup the spec file on the
 * current working directory.
 */
export default async function tscc(tsccSpecJSONOrItsPath: string | IInputTsccSpecJSON) {
	const tsccLogger = new Logger(chalk.green("TSCC: "), process.stderr);
	const tsLogger = new Logger(chalk.blue("TS: "), process.stderr);

	const tsccSpec: ITsccSpecWithTS = TsccSpecWithTS.loadSpecWithTS(
		tsccSpecJSONOrItsPath,
		process.cwd(),
		(msg) => {tsccLogger.log(msg);}
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
	// const depsSorter = new DepsSorter();
	// if (tsccSpec.shouldUseClosureDeps()) depsSorter.addClosureDeps();

	let isFirstFile = true;
	const pushToStdInStream = (...args: string[]) => {
		for (let arg of args) {
			stdInStream.push(arg);
		}
	};
	const pushVinylToStdInStream = (json: IClosureCompilerInputJSON) => {
		if (isFirstFile) isFirstFile = false;
		else pushToStdInStream(",");
		pushToStdInStream(JSON.stringify(json));
	}
	const pushImmediately = (...args: string[]) => {
		setImmediate(pushToStdInStream, ...args);
	};
	const tsickleOutput: Map<string, IClosureCompilerInputJSON> = new Map();
	const writeFileHook = (filePath: string, contents: string) => {
		if (tsccSpec.isDebug()) {
			fsExtra.outputFileSync(path.join(tempFileDir, filePath), contents);
		}
		filePath = path.resolve(filePath);
		closureDepsGraph.addSourceByContent(filePath, contents);
		tsickleOutput.set(filePath, {
			src: contents,
			path: path.isAbsolute(filePath) ? path.resolve(process.cwd(), filePath) : filePath
		});
	};

	const tempFileDir = path.join(process.cwd(), TEMP_DIR, tsccSpec.getProjectHash());
	fsExtra.mkdirpSync(tempFileDir);

	pushImmediately("[");
	// Manually push tslib, goog(base.js), goog.reflect, which are required in compilation
	libs.forEach(({path, id}) => {
		if (closureDepsGraph.hasModule(id)) return;
		writeFileHook(path, fs.readFileSync(path, 'utf8'))
	})

	const result = tsickle.emitWithTsickle(program, transformerHost, tsccSpec.getCompilerHost(),
		tsccSpec.getCompilerOptions(), undefined, writeFileHook, undefined, false, {
			afterTs: [
				decoratorPropertyTransformer(transformerHost),
				externalModuleTransformer(tsccSpec, transformerHost, program.getTypeChecker())
			]
		});
	// If tsickle errors, print diagnostics and exit. 
	if (result.diagnostics.length) throw new TsError(result.diagnostics);

	const {src, flags} = closureDepsGraph.getSortedFilesAndFlags(
		tsccSpec.getOrderedModuleSpecs().map(entry => ({
			moduleId: transformerHost.pathToModuleName(entry.entry, '.'),
			...entry
		}))
	)
	if (tsccSpec.isDebug()) {
		tsccLogger.log(`File orders:`);
		src.forEach(sr => tsccLogger.log(sr));
	}
	setImmediate(() => {
		src.forEach(name => {
			let out = tsickleOutput.get(name);
			if (!out) {
				tsccLogger.log(`File not emitted from tsickle: ${name}`);
			} else {
				pushVinylToStdInStream(out);
			}
		})
	});

	// Write externs to a temp file.
	// ..only after attaching tscc's generated externs
	const externs = tsickle.getGeneratedExterns(result.externs, '') +
		getExternsForExternalModules(tsccSpec, transformerHost);
	const tempFilePath = path.join(tempFileDir, "externs_generated.js");
	fs.writeFileSync(tempFilePath, externs);

	pushImmediately("]");
	pushImmediately(null);
	const stdInStream = new stream.Readable({read: function () {}});

	return new Promise((resolve, reject) => {
		/**
		 * Spawn compiler process with module dependency information
		 */
		const ccLogger = new Logger(chalk.redBright("ClosureCompiler: "), process.stderr);
		ccLogger.startTask("Closure Compiler");
		const compilerProcess = spawnCompiler([
			"-jar", require.resolve('google-closure-compiler-java/compiler.jar'),
			...tsccSpec.getBaseCompilerFlags(),
			...flags,
			'--json_streams', "IN",
			'--externs', tempFilePath,
			'--externs', tslibExternsPath
		], (code) => {
			if (code === 0) {
				ccLogger.succeed();
				ccLogger.unstick();
				tsccLogger.log(`Compilation success.`)
				if (tsccSpec.isDebug()) tsccLogger.log(tsccSpec.getOutputFileNames().join('\n'));
				tsccSpec.getOutputFileNames().forEach(removeCcExport)
				resolve();
			} else {
				ccLogger.fail(`Closure compiler error`);
				ccLogger.unstick();
				ccLogger.log(`Exited with code ${code}.`);
				reject(new CcError(String(code)));
			}
		}, ccLogger, tsccSpec.isDebug());

		stdInStream.pipe(compilerProcess.stdin);
	});
}

const tsLibDir = path.resolve(__dirname, '../third_party/tsickle/third_party/tslib');
const tsLibPath = path.join(tsLibDir, 'tslib.js');
const tslibExternsPath = path.join(tsLibDir, 'externs.js');
const closureLibDir = path.resolve(__dirname, '../third_party/closure_library');
const googBasePath = path.join(closureLibDir, 'base.js');
const googReflectPath = path.join(closureLibDir, 'reflect.js');

const libs = [
	{path: tsLibPath, id: "tslib"},
	{path: googBasePath, id: "goog"},
	{path: googReflectPath, id: "goog.reflect"}
]

export class CcError extends Error {}

function spawnCompiler(args: string[], onClose: (code: number) => void, logger: Logger, debug?: boolean) {
	if (debug) logger.log(`args: java ` + args.join(' '));
	const compilerProcess = require('child_process').spawn('java', args);
	compilerProcess.stdout.on('data', (data) => {
		logger.write(data);
	});
	compilerProcess.stderr.on('data', (data) => {
		logger.log(data);
	})
	compilerProcess.on('error', (err) => {
		logger.log(chalk.red(`Closure compiler spawn error, Is java in your path?\n${err.message}`));
		onClose(1);
	});
	compilerProcess.on('close', onClose);
	return compilerProcess;
}

declare interface IClosureCompilerInputJSON {
	path: string,
	src: string,
	sourceMap?: string
}

function getTsickleHost(tsccSpec: ITsccSpecWithTS, logger: Logger): tsickle.TsickleHost {
	const options = tsccSpec.getCompilerOptions();
	const compilerHost = tsccSpec.getCompilerHost();

	// For the part where replacing fileNames to absolute paths, it is just following
	// what tsickle does, it's unclear what TS will give us!
	// Apparently, TS seems to be giving fileNames relative to process.cwd().
	const fileNamesSet = tsccSpec.getAbsoluteFileNamesSet();

	const externalModuleNames = tsccSpec.getExternalModuleNames();
	const resolvedExternalModuleTypeRefs: string[] = [];

	let hasTypeBlacklistedSymbols = false;
	for (let i = 0, l = externalModuleNames.length; i < l; i++) {
		let name = externalModuleNames[i];
		let typeRefFileName = tsccSpec.resolveExternalModuleTypeReference(name);
		if (typeRefFileName) {
			resolvedExternalModuleTypeRefs.push(typeRefFileName);
		} else {
			// Can't achieve blacklisting via TsickleHost.typeBlacklistPaths API
			hasTypeBlacklistedSymbols = true;
			registerTypeBlacklistedModuleName(name);
		}
	}
	if (hasTypeBlacklistedSymbols) {
		patchTypeTranslator();
	}

	const externalModuleRoots = resolvedExternalModuleTypeRefs
		.map(fileName => {
			// From a resolved file name, extract its containing folder in node_modules.
			let segments = path.normalize(fileName).split(path.sep);
			let i = segments.lastIndexOf("node_modules");
			let moduleDir = segments.slice(0, i + 2).join(path.sep);
			return moduleDir + path.sep;
		});

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
		es5Mode: options.target === ts.ScriptTarget.ES3 || options.target === ts.ScriptTarget.ES5,
		googmodule: true,
		transformDecorators: true,
		transformTypesToClosure: true,
		typeBlackListPaths: new Set(resolvedExternalModuleTypeRefs),
		enableAutoQuoting: false,
		untyped: false,
		logWarning(warning) {
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
			// Resolve module via ts API	
			const resolved = ts.resolveModuleName(fileName, context, options, compilerHost);
			if (resolved && resolved.resolvedModule) {
				return convertToGoogModuleAdmissibleName(resolved.resolvedModule.resolvedFileName)
			}
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

