///<reference types="jest" />
import {sourceNodeFactory, sourceNodeFactoryFromContent} from '../../src/graph/source_node_factory';
import path = require('path');
import fs = require('fs');

describe("sourceNodeFactory", function () {
	test(`produces objects matching source node interface`, async function () {
		const node = await sourceNodeFactory(sample("goog_module.js"));
		expect(node.fileName).toBe(sample("goog_module.js"));
		expect(node.provides).toEqual(["this.is.a.goog.module"]);
		expect(node.required.slice().sort()).toEqual(["another.module", "goog"]);
		expect(node.forwardDeclared.slice().sort()).toEqual(["another.module", "type.only.module"]);
	})
})

describe("sourceNodeFactoryFromContent", function () {
	test(`produces objects matching source node interface`, function () {
		const node = sourceNodeFactoryFromContent(sample("goog_module.js"), readSample("goog_module.js"));
		expect(node.fileName).toBe(sample("goog_module.js"));
		expect(node.provides).toEqual(["this.is.a.goog.module"]);
		expect(node.required.slice().sort()).toEqual(["another.module", "goog"]);
		expect(node.forwardDeclared.slice().sort()).toEqual(["another.module", "type.only.module"]);
	});
	test(`produces goog base from @provideGoog`, function () {
		const content1 = `
/**
 * @provideGoog
 */`;
		const node1 = sourceNodeFactoryFromContent('virtual_file_name', content1);
		expect(node1.provides).toEqual(["goog"]);
		expect(node1.required).toEqual([]);

		const content2 = `/** @provideGoog */`;
		const node2 = sourceNodeFactoryFromContent('virtual_file_name', content2);
		expect(node2.provides).toEqual(["goog"]);
		expect(node2.required).toEqual([]);
	})
})

function sample(name: string) {
	return path.resolve(__dirname, '..', 'sample', name);
}

function readSample(name: string) {
	return fs.readFileSync(sample(name), 'utf8');
}

