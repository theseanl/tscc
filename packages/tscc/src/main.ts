#!/usr/bin/env node

import minimist = require('minimist');
import chalk from 'chalk';
import tscc, {TEMP_DIR, CcError} from './tscc';
import {TsError} from './spec/TsccSpecWithTS'
import {TsccSpecError} from '@tscc/tscc-spec'
import Logger from './log/Logger';
/**
 * example: tscc -c src/tscc.spec.json
 * TODO Support passing json with command line arguments
 */
async function main(args) {
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
	await tscc(args.spec, args.project);
	return 0;
}

if (require.main === module) {
	const tsccLogger = new Logger(chalk.green('TSCC: '));
	const tsLogger = new Logger(chalk.blue('TS: '));
	main(minimist(process.argv.slice(2), {
		string: ["spec", "project"],
		boolean: ["clean", "help", "version"],
		alias: {
			"spec": "c",
			"help": "h",
			"version": "v",
			"project": "p"
		},
		unknown: (arg) => {
			console.error(`Unknown argument: ${arg}`);
			printHelp();
			process.exit(1);
		}
	}))
		.then(code => process.exit(code))
		.catch(e => {
			if (e instanceof TsccSpecError) {
				tsccLogger.log(e.message);
			} else if (e instanceof TsError) {
				tsLogger.log(e.message);
			} else if (e instanceof CcError) {
				// pass
			} else {
				tsccLogger.log(chalk.red(`The compilation terminated with an unexpected error.`));
				tsccLogger.log(e);
				tsccLogger.log(e.stack);
			}
			process.exit(1);
		})
}

function printHelp() {
	printVersion();
	console.log(`
Usage: tscc --spec [<specFilePath>]    : Compile with tscc spec file at the path.
                                         Defaults to the current working directory.
                                         alias: -c
            --project [<tsconfigPath>] : path to the tsconfig.json file, similar to
                                         tsc --project argument. Defaults to the 
                                         current working directory. alias: -p
       tscc --clean                    : Clear temporary files.
       tscc --version                  : Prints version. alias: -v
       tscc --help                     : Prints this.
`.trim())
}
function printVersion() {
	console.log(`tscc ` + require('../package.json').version);
}
