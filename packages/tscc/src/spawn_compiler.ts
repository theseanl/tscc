import Logger from './log/Logger';
import chalk = require('chalk');
import childProcess = require('child_process');

export interface CompilerProcess {
	bin: string;
	args: string[];
}  

export default function spawnCompiler(providedArgs: string[], logger: Logger, debug?: boolean) {
	const { bin, args } = getSupportedCompiler();
	args.push(...providedArgs);

	if (debug) logger.log(`args: ${bin} ` + args.join(' '));

	const compilerProcess = childProcess.spawn(bin, args);

	// TODO consider moving this to tscc.ts.
	compilerProcess.stderr.on('data', (data) => {
		logger.log(data);
	});
	
	compilerProcess.on('error', (err) => {
		logger.log(chalk.red(`Closure compiler spawn error, Is java in your path?\n${err.message}`));
		//	onClose(1);
	});

	return compilerProcess;
}

function getSupportedCompiler() : CompilerProcess {
	let pkgName;
	const platform = process.platform;

	switch (platform) {
		case 'darwin':
		case 'win32':
		case 'linux':
			pkgName = PlatformToCompilerPackageName[platform];
			break;
		default:
			throw new Error(`Platform "${platform}" is unsupported.`);
	}

	if (pkgName) {
		try {
			// Try resolving optional dependencies
			return {
				bin: require(pkgName),
				args: []
			};
		} catch (e) {}
	}

	// Not found, defaults to JAVA version.
	return {
		bin: 'java',
		args: ['-jar', require('google-closure-compiler-java')]
	};
}

enum PlatformToCompilerPackageName {
	'darwin' = 'google-closure-compiler-osx',
	'win32' = 'google-closure-compiler-windows',
	'linux' = 'google-closure-compiler-linux'
}

