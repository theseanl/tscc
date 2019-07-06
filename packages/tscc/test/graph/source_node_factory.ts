///<reference types="jest" />
import {sourceNodeFactory, sourceNodeFactoryFromContent} from '../../src/graph/source_node_factory';
import path = require('path');
import fs = require('fs');

describe("sourceNodeFactory", function () {
	test(`produces objects matching source node interface`, async function () {
		const node = await sourceNodeFactory(sample("goog_module.js"));
		expect(node.fileName).toBe(sample("goog_module.js"));
		expect(node.provides).toEqual(["this.is.a.goog.module"]);
		expect(node.required.sort()).toEqual(["another.module", "goog"]);
		expect(node.forwardDeclared.sort()).toEqual(["another.module", "type.only.module"]);
	})
})

describe("sourceNodeFactoryFromContent", function () {
	test(`produces objects matching source node interface`, function () {
		const node = sourceNodeFactoryFromContent(sample("goog_module.js"), readSample("goog_module.js"));
		expect(node.fileName).toBe(sample("goog_module.js"));
		expect(node.provides).toEqual(["this.is.a.goog.module"]);
		expect(node.required.sort()).toEqual(["another.module", "goog"]);
		expect(node.forwardDeclared.sort()).toEqual(["another.module", "type.only.module"]);
	})
})

function sample(name: string) {
	return path.resolve(__dirname, '..', 'sample', name);
}

function readSample(name: string) {
	return fs.readFileSync(sample(name), 'utf8');
}

