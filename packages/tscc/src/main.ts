#!/usr/bin/env node

import yargs = require('yargs/yargs');
import chalk = require('chalk');
import tscc, { TEMP_DIR, CcError, TsccError } from './tscc';
import { TsError } from './spec/TsccSpecWithTS'
import { IInputTsccSpecJSON, INamedModuleSpecs, TsccSpecError, primitives } from '@tscc/tscc-spec'
import { ClosureDepsError } from './graph/ClosureDependencyGraph'
import Logger from './log/Logger';
import console = require('console');

/**
 * example: tscc -s src/tscc.spec.json -- --experimentalDecorators -- --assume_function_wrapper
 */
async function main(args: { [key: string]: any }) {
	if (args.clean) {
		require('rimraf').sync(TEMP_DIR);
		console.log(`Removed ${TEMP_DIR}.`);
		return 0;
	}

	if (args['module'] === undefined && args['spec'] === undefined) {
		// Assumes that --spec was set to the current working directory implicitly.
		args['spec'] = '.';
	}

	const { tsccSpecJSON, tsArgs } = buildTsccSpecJSONAndTsArgsFromArgs(args);
	await tscc(<IInputTsccSpecJSON>tsccSpecJSON, tsArgs);

	return 0;
}

export function parseTsccCommandLineArgs(args: string[], strict = true): { [key: string]: primitives | primitives[] } {
	return <any>yargs()
		.scriptName('tscc')
		.usage(`tscc [--help] [--clean] [--spec <spec_file_path>] [-- <typescript_flags> [-- <closure_compiler_flags>]]`)
		.describe(
			'spec',
			`Perform compilation with tscc spec file at the specified path. ` +
			`Defaults to the current working directory.`
		)
		.string('spec')
		.describe(
			'module',
			`Module spec descriptions. ` +
			`Format: <name>:<entry_file>[:<dependency_name>[,<dependency2_name>[...]][:<extra_source>[,...]]]`
		)
		.string('module')
		.array('module')
		.describe(
			'external',
			'External module descriptions. Format: <module_name>:<global_name>'
		)
		.string('external')
		.array('external')
		.describe(
			'prefix',
			`Directory names to emit outputs in, or prefixes for output file names. ` +
			`It will just be prepended to module names, so if its last character is not a path separator, ` +
			`it will modify the output file's name. Sub-flags --prefix.cc and --prefix.rollup are available.`
		)
		.describe(
			'prefix.cc',
			`Prefix to be used only by closure compiler build.`
		)
		.describe(
			'prefix.rollup',
			`Prefix to be used only by rollup build.`
		)
		.describe(
			'debug',
			`A namespace for debugging options.`
		)
		.describe(
			'debug.persistArtifacts',
			`Writes intermediate tsickle outputs to .tscc_temp directory.`
		)
		.describe(
			'debug.ignoreWarningsPath',
			`Prevents tsickle warnings for files whose path contains substrings provided by this flag.`
		)
		.array('debug.ignoreWarningsPath')
		.describe(
			'clean',
			`Clear temporary files in .tscc_temp directory.`
		)
		.describe(
			'-',
			`Any flags after the first "--" and before the second "--" (if exists) ` +
			`will be provided to the typescript compiler.`
		)
		.describe(
			'{2}',
			`Any flags after the second "--" will be provided to the closure compiler.`
		)
		.epilogue(
			`For more information or bug reports, please visit https://github.com/theseanl/tscc.`
		)
		.alias({
			"spec": "s",
			"h": "help",
			"v": "version",
		})
		.parserConfiguration({
			'populate--': true,
			'camel-case-expansion': false
		})
		.strict(strict)
		.help('h')
		.version()
		.parse(args);
}

export function buildTsccSpecJSONAndTsArgsFromArgs(args: { [key: string]: any; }) {
	const tsArgs = <string[]>args["--"] || [];
	const closureCompilerArgs: string[] = (<any>yargs()
		.parserConfiguration({ 'populate--': true })
		.parse(tsArgs))["--"] || [];

	let i = tsArgs.indexOf('--');
	if (i !== -1) {
		tsArgs.splice(i);
	}

	const out: Partial<IInputTsccSpecJSON> = {};

	// module flags
	// Using "--module" instead of "--modules" looks more natural for a command line interface.
	let moduleFlags: string[] = args["module"];
	if (moduleFlags) {
		const moduleFlagValue: INamedModuleSpecs[] = [];

		for (let moduleFlag of moduleFlags) {
			// --modules chunk2:./src/chunk2.ts:chunk0,chunk1:css_renaming_map.js
			let [
				moduleName,
				entry,
				dependenciesStr,
				extraSourcesStr
			] = moduleFlag.split(':');

			let dependencies: string[] | undefined,
				extraSources: string[] | undefined;

			if (dependenciesStr) dependencies = dependenciesStr.split(',');
			if (extraSourcesStr) extraSources = extraSourcesStr.split(',');

			moduleFlagValue.push({
				moduleName,
				entry,
				dependencies,
				extraSources
			});
		}
		out.modules = moduleFlagValue;
	}

	// external flags
	// --external react-dom:ReactDOM
	let external: string[] = args["external"]
	if (external) {
		const externalValue: { [moduleName: string]: string } = {};
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
		let compilerFlags = yargs().parse(closureCompilerArgs);
		// delete special args produced by yargs
		/** @ts-ignore */
		delete compilerFlags["_"], delete compilerFlags["$0"];
		out.compilerFlags = <any>compilerFlags;
	}

	// debug flags
	let debugArgs = args["debug"];
	if (debugArgs && typeof debugArgs === 'object') {
		out.debug = debugArgs;
	}

	// spec file
	if (args["spec"]) {
		out.specFile = args["spec"];
	}

	return { tsccSpecJSON: <IInputTsccSpecJSON>out, tsArgs }
}

if (require.main === module) {
	const tsccWarning = new Logger(chalk.green('TSCC: '));
	const tsWarning = new Logger(chalk.blue('TS: '));

	const parsedArgs = parseTsccCommandLineArgs(process.argv.slice(2));

	main(parsedArgs)
		.then(code => process.exit(code))
		.catch(e => {
			if (e instanceof TsccSpecError || e instanceof TsccError) {
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
		});
}

