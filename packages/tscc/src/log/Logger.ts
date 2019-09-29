/**
 * Creates a logger instance, which provides the following functionalities:
 *  - Adding prefix
 *  - Adding a spinner that sticks at the bottom
 * It should be okay to have multiple instances that are writing to the same tty.
 */
import ora = require('ora');
import readline = require('readline');
import console = require('console');

export default class Logger {
	private console: Console
	private spinner: ora.Ora
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
			if (this.spinner) {
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
			if (this.spinner) {
				this.out.write('\n');
			}
		}
	}
	/**
	 * Attach a spinner that sticks at the bottom of the stream,
	 * indicating that a task is running.
	 */
	startTask(text: string) {
		this.spinner = ora({
			text,
			stream: this.out,
			spinner: "dots12",
			// See https://github.com/theseanl/tscc/issues/70
			// If this option is not set, it can lead to very strange behaviors.
			// 'discarding stdin' does it by overriding globals and it is badly done. 
			discardStdin: false
		});
		this.spinner.start();
		const start = Date.now();
		this.timer = setInterval(() => {
			this.spinner.text = text + " " + toDDHHMMSS(Date.now() - start);
		}, 1000);
	}
	private timer: NodeJS.Timer;
	succeed(text?:string) {
		this.spinner.succeed(text);
		clearInterval(this.timer);
		this.timer = undefined;
	}
	fail(text?:string) {
		this.spinner.fail(text);
		clearInterval(this.timer);
		this.timer = undefined;
	}
	/**
	 * Even if a task might have ended (via succeed or fail) the spinner will
	 * still stick at the bottom. After calling this method, all subsequent
	 * writes will happen below the spinner.
	 */
	unstick() {
		if (!this.spinner) return;
		if (this.spinner.isSpinning) this.spinner.stop();
		this.spinner = undefined;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}
}

function toDDHHMMSS(milliseconds: number) {
	let sec_num = Math.floor(milliseconds / 1000);
	let days = Math.floor(sec_num / 86400);
	let hours = Math.floor(sec_num / 3600);
	let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	let seconds = sec_num - (hours * 3600) - (minutes * 60);

	let out = '';
	if (days > 0) out += String(days) + ":";
	if (days > 0 || hours > 0) out += String(hours) + ":";
	out += String(minutes).padStart(2, "0");
	out += ":";
	out += String(seconds).padStart(2, "0");
	return out;
}

