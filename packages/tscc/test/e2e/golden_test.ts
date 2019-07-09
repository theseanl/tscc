///<reference types="jest"/>
import tscc, {TEMP_DIR} from '../../src/tscc';
import path = require('path');
import fs = require('fs');

const fsp = fs.promises;

describe(`tscc e2e`, function () {
	// Create output in temp directory, compare its contents with golden files
	const samplesRoot = path.join(__dirname, './sample/');
	const directories = fs.readdirSync(samplesRoot, {withFileTypes: true})
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	const TIMEOUT = 20 * 1000; // 20 seconds

	test.each(directories)(`%s`, async function (dirName) {
		const projectRoot = path.join(samplesRoot, dirName);

		await tscc(projectRoot, projectRoot);

		const generatedFiles = (await fsp.readdir(path.join(TEMP_DIR, dirName), {withFileTypes: true}))
			.filter(dirent => dirent.isFile())
			.map(dirent => dirent.name)
			.sort();
		await Promise.all(generatedFiles.map(async (fileName) => {
			expect(await fsp.readFile(path.join(TEMP_DIR, dirName, fileName), 'utf8'))
				.toMatchSnapshot(dirName + '/' + fileName);
		}))
	}, TIMEOUT)
})

