import Logger from './log/Logger';
import chalk = require('chalk');
import childProcess = require('child_process');

export default function spawnCompiler(providedArgs: string[], logger: Logger, debug?: boolean) {
	const {bin, args} = getSupportedCompiler();
	args.push(...providedArgs);

	if (debug) logger.log(`args: ${bin} ` + args.join(' '));

	const compilerProcess = childProcess.spawn(bin, args);

	// TODO consider moving this to tscc.ts.
	compilerProcess.stderr.on('data', (data) => {
		logger.log(data);
	})
	compilerProcess.on('error', (err) => {
		logger.log(chalk.red(`Closure compiler spawn error, Is java in your path?\n${err.message}`));
		//	onClose(1);
	});
	return compilerProcess;
}

function getSupportedCompiler(): {bin: string, args: string[]} {
	const pkgName = PlatformToCompilerPackageName[process.platform];
	if (pkgName) {
		try {
			// Try resolving optional dependencies
			return {bin: require(pkgName), args: []};
		} catch (e) {}
	}
	// Not found, defaults to JAVA version.
	return {bin: 'java', args: ['-jar', require('google-closure-compiler-java')]};
}

enum PlatformToCompilerPackageName {
	'darwin' = 'google-closure-compiler-osx',
	'win32' = 'google-closure-compiler-windows',
	'linux' = 'google-closure-compiler-linux',
	'aix' = '',
	'android' = '',
	'freebsd' = '',
	'openbsd' = '',
	'sunos' = '',
	'cygwin' = '',
	'netbsd' = ''
}
