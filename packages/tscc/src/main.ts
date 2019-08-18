#!/usr/bin/env node

import minimist = require('minimist');
import chalk from 'chalk';
import tscc, {TEMP_DIR, CcError} from './tscc';
import {TsError} from './spec/TsccSpecWithTS'
import {IInputTsccSpecJSON, INamedModuleSpecs, TsccSpecError} from '@tscc/tscc-spec'
import {ClosureDepsError} from './graph/ClosureDependencyGraph'
import Logger from './log/Logger';
import console = require('console');

/**
 * example: tscc -s src/tscc.spec.json -- --experimentalDecorators -- --assume_function_wrapper
 */
async function main(args: minimist.ParsedArgs) {
	if (args.version) {
		printVersion();
		return 0;
	}
	if (args.help) {
		printHelp();
		return 0;
	}
	if (args.clean) {
		require('rimraf').sync(TEMP_DIR);
		console.log(`Removed ${TEMP_DIR}.`);
		return 0;
	}

	if (args['module'] === args['spec'] === undefined) {
		// Assumes that --spec was set to the current working directory implicitly.
		args['spec'] = '.';
	}

	const {tsccSpecJSON, tsArgs} = buildTsccSpecJSONAndTsArgsFromArgs(args);
	await tscc(<IInputTsccSpecJSON>tsccSpecJSON, tsArgs);

	return 0;
}

if (require.main === module) {
	const tsccWarning = new Logger(chalk.green('TSCC: '));
	const tsWarning = new Logger(chalk.blue('TS: '));
	main(minimist(process.argv.slice(2), {
		string: [
			"spec",
			"module",
			"external",
			"prefix",
			"prefix.cc",
			"prefix.rollup",
			"debug.ignoreWarningsPath"
		],
		boolean: [
			"clean",
			"help",
			"version",
			"debug.persistArtifacts"
		],
		alias: {
			"spec": "s",
			"help": "h",
			"version": "v",
			"project": "p"
		},
		unknown: (arg) => {
			tsccWarning.log(`Unknown argument: ${arg}`);
			printHelp();
			process.exit(1);
			return false;
		},
		'--': true
	}))
		.then(code => process.exit(code))
		.catch(e => {
			if (e instanceof TsccSpecError) {
				tsccWarning.log(chalk.red(e.message));
			} else if (e instanceof TsError) {
				tsWarning.log(chalk.red(e.message));
			} else if (e instanceof ClosureDepsError) {
				tsccWarning.log(chalk.red(e.message));
			} else if (e instanceof CcError) {
				tsccWarning.log(chalk.red(e.message));
			} else {
				tsccWarning.log(chalk.red(`The compilation has terminated with an unexpected error.`));
				tsccWarning.log(e.stack);
				return process.exit(1);
			}
			tsccWarning.log(`The compilation has terminated with an error.`)
			return process.exit(1);
		})
}

function printHelp() {
	printVersion();
	console.log(`
Usage: tscc --spec VAL                 : Compile with tscc spec file at the path.
                                         Defaults to the current working directory.
                                         alias: -s
            --module VAL               : Module spec descriptions. Format: <name>:<entry_file>[:
                                         <dependency_name>[,<dependency2_name>[...]]
                                         [:<extra_source>[,...]]]
            --external VAL             : External module descriptions.
                                         Format: <module_name>:<global_name>
            --prefix VAL               : Directory names to emit outputs in, or prefixes for output
                                         file names. It will just be prepended to module names,
                                         so if its last character is not a path separator, it will
                                         modify the output file's name. Sub-flags --prefix.cc and
                                         --prefix.rollup are available.
                    .cc     VAL        : Prefix to be only used by closure compiler build.
                    .rollup VAL        : Prefix to be only used by rollup build.

            --debug
                   .persistArtifacts   : Writes intermediate tsickle outputs to .tscc_temp directory.
                   .ignoreWarningsPath : Prevents tsickle warnings for files whose path contains
                                         substrings provided by this flag.

            --                         : Any flags after the first "--" and the second "--" (if exists)
                                         are treated as flags to be passed to typescript compiler.
            --                         : Any flags after the second "--" are treated as flags to be
                                         passed to closure compiler.

       tscc --clean                    : Clear temporary files in .tscc_temp.
       tscc --version                  : Prints version. alias: -v
       tscc --help                     : Prints this. alias: -h
`.trim())
}

function printVersion() {
	console.log(`tscc ` + require('../package.json').version);
}

export function buildTsccSpecJSONAndTsArgsFromArgs(args: minimist.ParsedArgs) {
	const tsArgs = <string[]>args["--"] || [];
	const closureCompilerArgs = minimist(tsArgs, {'--': true})["--"] || [];

	let i = tsArgs.indexOf('--');
	if (i !== -1) {
		tsArgs.splice(i);
	}

	const out: Partial<IInputTsccSpecJSON> = {};

	// module flags
	// Using "--module" instead of "--modules" looks more natural for a command line interface.
	let moduleFlags: string | string[] = args["module"];
	if (moduleFlags) {
		if (typeof moduleFlags === 'string') moduleFlags = [moduleFlags];
		const moduleFlagValue: INamedModuleSpecs[] = [];
		for (let moduleFlag of moduleFlags) {
			// --modules chunk2:./src/chunk2.ts:chunk0,chunk1:css_renaming_map.js
			let [moduleName, entry, dependenciesStr, extraSourcesStr] = moduleFlag.split(':');
			let dependencies: string[], extraSources: string[];
			if (dependenciesStr) dependencies = dependenciesStr.split(',');
			if (extraSourcesStr) extraSources = extraSourcesStr.split(',');
			moduleFlagValue.push({moduleName, entry, dependencies, extraSources})
		}
		out.modules = moduleFlagValue;
	}

	// external flags
	// --external react-dom:ReactDOM
	let external: string | string[] = args["external"]
	if (external) {
		const externalValue: {[moduleName: string]: string} = {};
		if (typeof external === 'string') external = [external];
		for (let externalEntry of external) {
			let [moduleName, globalName] = externalEntry.split(':');
			externalValue[moduleName] = globalName;
		}
		out.external = externalValue;
	}

	// prefix flags
	if (args["prefix"]) {
		out.prefix = args["prefix"];
	}

	// compilerFlags flags
	if (closureCompilerArgs.length) {
		let compilerFlags = minimist(closureCompilerArgs);
		delete compilerFlags["_"]; // delete special arg produced by minimist
		out.compilerFlags = compilerFlags;
	}

	// debug flags
	let debugArgs = args["debug"];
	if (debugArgs && typeof debugArgs === 'object') {
		ensureArray(debugArgs, "ignoreWarningsPath");
		out.debug = debugArgs;
	}

	// spec file
	if (args["spec"]) {
		out.specFile = args["spec"];
	}

	return {tsccSpecJSON: <IInputTsccSpecJSON>out, tsArgs}
}

function ensureArray(obj: object, prop: string): void {
	let val = obj[prop];
	if (typeof val !== 'undefined' && !Array.isArray(val)) {
		obj[prop] = [val];
	}
}

