import Logger from './log/Logger';
import chalk from 'chalk';

export default function spawnCompiler(args: string[], onClose: (code: number) => void, logger: Logger, debug?: boolean) {
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


