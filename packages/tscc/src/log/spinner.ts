import ora = require('ora');

let spinner: ora.Ora;
let timer: NodeJS.Timer;

/**
 * Attach a spinner that sticks at the bottom of the stream,
 * indicating that a task is running.
 */
export function startTask(text: string) {
	if (hasSpinner()) unstick();
	spinner = ora({
		text,
		stream: process.stderr,
		spinner: "dots12",
		// See https://github.com/theseanl/tscc/issues/70
		// If this option is not set, it can lead to very strange behaviors.
		// 'discarding stdin' does it by overriding globals and it is badly done. 
		discardStdin: false
	});
	spinner.start();
	const start = Date.now();
	timer = setInterval(() => {
		spinner.text = text + " " + toDDHHMMSS(Date.now() - start);
	}, 1000);
}

export function succeed(text?: string) {
	if (!hasSpinner()) return;
	spinner.succeed(text);
	clearInterval(timer);
	timer = undefined;
}

export function fail(text?: string) {
	if (!hasSpinner()) return;
	spinner.fail(text);
	clearInterval(timer);
	timer = undefined;
}

/**
 * Even if a task might have ended (via succeed or fail) the spinner will
 * still stick at the bottom. After calling this method, all subsequent
 * writes will happen below the spinner.
 */
export function unstick() {
	if (!hasSpinner()) return;
	if (spinner.isSpinning) spinner.stop();
	spinner = undefined;
	if (timer) {
		clearInterval(timer);
		timer = undefined;
	}
}

export function hasSpinner() {
	return typeof spinner !== 'undefined';
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

