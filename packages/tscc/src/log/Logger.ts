/**
 * @fileoverview Creates a logger instance, which provides the following functionalities:
 *  - Adding prefix
 *  - Adding a spinner that sticks at the bottom
 * It should be okay to have multiple instances that are writing to the same tty.
 */
import ora = require('ora');
import readline = require('readline');
import console = require('console');
import { hasSpinner } from './spinner'

export default class Logger {
	private console: Console
	constructor(
		private prefix: string,
		private out: NodeJS.WritableStream = process.stderr
	) {
		this.console = new console.Console(this.out);
	}
	/**
	 * Analogous to console.log - applies basic formatting, adds a newline at the end.
	 */
	@Logger.eraseSpinner
	log(msg: string, ...args: any[]) {
		this.console.log(this.prefix + msg, ...args);
	}
	/**
	 * Analogous to process.stdout.write() - no formatting
	 */
	@Logger.eraseSpinner
	write(msg: string) {
		this.out.write(msg);
	}
	private static eraseSpinner(target: Object, prop: string, desc: PropertyDescriptor) {
		let origMethod = desc.value;
		desc.value = function (this: Logger) {
			if (hasSpinner()) {
				readline.clearLine(this.out, 0);
				/*
				 * Restore cursor position
				 * {@link https://stackoverflow.com/questions/10585683/how-do-you-edit-existing-text-and-move-the-cursor-around-in-the-terminal}
				 */
				this.out.write('\x1b[u');
			}
			Reflect.apply(origMethod, this, arguments);
			// store cursor position & move to the newline
			this.out.write('\x1b[s');
			if (hasSpinner()) {
				this.out.write('\n');
			}
		}
	}
}

