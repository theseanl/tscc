///<reference types="jest"/>
import tscc, {TEMP_DIR} from '../../src/tscc';
import path = require('path');
import upath = require('upath');
import fs = require('fs');

const fsp = fs.promises;

describe(`tscc e2e`, function () {
	// Create output in temp directory, compare its contents with golden files
	const samplesRoot = path.join(__dirname, './sample/');
	const directories = fs.readdirSync(samplesRoot, {withFileTypes: true})
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	const TIMEOUT = 30 * 1000; // 20 seconds

	test.each(directories)(`%s`, async function (dirName) {
		const projectRoot = path.join(samplesRoot, dirName);

		await tscc(projectRoot);

		const generatedFiles = (await fsp.readdir(path.join(TEMP_DIR, dirName), {withFileTypes: true}))
			.filter(dirent => dirent.isFile())
			.map(dirent => dirent.name)
			.sort();

		expect(generatedFiles).toMatchSnapshot(dirName);
		await Promise.all(generatedFiles.map(async (fileName) => {
			let content = await fsp.readFile(path.join(TEMP_DIR, dirName, fileName), 'utf8')
			// Apparently Closure Compiler is emitting OS-style paths in output sourcemap. Here we
			// pick up sourcemaps, and normalize path in its `file` property to make snapshots
			// indepent of the OS.
			if (path.extname(fileName) === '.map') {
				let sourceMap = JSON.parse(content);
				sourceMap.file = upath.toUnix(sourceMap.file);
				content = JSON.stringify(sourceMap);
			}
			expect(content).toMatchSnapshot(dirName + '/' + fileName);
		}))
	}, TIMEOUT)
})
