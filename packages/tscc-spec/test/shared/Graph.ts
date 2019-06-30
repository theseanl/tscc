///<reference types="jest"/>
import {DirectedTreeBase, DirectedTree, DirectedTreeWithOrdering, DirectedTreeWithLeafs} from "@tscc/tscc-spec"

function compareGraphStructure(nodes, edges, poset) {
	for (let id of nodes) {
		let node = poset.getNodeById(id);
		let expectedTargets = edges.filter(([a, b]) => a === id).map(([a, b]) => b);
		let expectedSources = edges.filter(([a, b]) => b === id).map(([a, b]) => a);
		let targets = [...node.iterateOutboundEdges()]
			.map(edge => edge.target)
			.map(poset.getIdOfNode, poset);
		let sources = [...node.iterateInboundEdges()]
			.map(edge => edge.source)
			.map(poset.getIdOfNode, poset);
		expect(new Set(expectedTargets)).toEqual(new Set(targets));
		expect(new Set(expectedSources)).toEqual(new Set(sources));
	}
}

function posetFromEdges<I>(poset: DirectedTreeBase<I, any, any>, edges: [I, I][]) {
	for (let [a, b] of edges) {
		poset.addEdgeById(a, b);
	}
}

describe(`DirectedTree`, function () {
	test(`can set a node via ID`, function () {
		const poset = new DirectedTree<string>();
		poset.addNodeById("myNodeId");
		expect(poset.getNodeById("myNodeId")).not.toBeUndefined();
		expect(poset.getIdOfNode(poset.getNodeById("myNodeId"))).toBe("myNodeId");
	})
	test(`creates nodes when it creates an edge`, function () {
		const poset = new DirectedTree<string>();
		poset.addEdgeById("a", "b");
		expect(poset.getNodeById("a")).not.toBeUndefined();
		expect(poset.getNodeById("b")).not.toBeUndefined()
	})
	describe(`sort`, function () {
		let poset: DirectedTree<number>;
		let nodes: number[]
		let edges: [number, number][];
		beforeEach(() => {
			poset = new DirectedTree<number>();
			nodes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
			edges = [
				[5, 4], [2, 3], [9, 1], [7, 8],
				[6, 2], [5, 3], [4, 8], [7, 9],
				[6, 5], [2, 7], [3, 1], [2, 5]
			];
			posetFromEdges(poset, edges);
		})
		test(`topologically sorts the provided tree`, function () {
			const sorted = poset.sort();
			for (let [a, b] of edges) {
				expect(sorted.indexOf(a)).toBeLessThan(sorted.indexOf(b))
			}
		})
		test(`throws on a graph with cycle`, function () {
			let poset = new DirectedTreeWithOrdering<number>();
			let edges: [number, number][] = [[0, 1], [1, 2], [2, 1], [2, 3], [1, 4], [2, 5]];
			posetFromEdges(poset, edges);
			expect(() => {poset.sort()}).toThrow();
		})
		test(`preserves the graph structure`, function () {
			poset.sort();
			compareGraphStructure(nodes, edges, poset);
		})
		test(`is idempotent`, function () {
			const sorted = poset.sort();
			const sorted2 = poset.sort();
			expect(sorted).toEqual(sorted2);
		})
	})
})
describe(`DirectedTreeWithOrdering`, function () {
	let poset: DirectedTreeWithOrdering<number>;
	let nodes: number[];
	let edges: [number, number][];
	beforeEach(() => {
		poset = new DirectedTreeWithOrdering<number>();
		nodes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		edges = [
			[5, 4], [2, 3], [9, 1], [7, 8],
			[6, 2], [5, 3], [4, 8], [7, 9],
			[6, 5], [2, 7], [3, 1], [2, 5]
		];
		posetFromEdges(poset, edges);
	})
	describe(`populateDependents`, function () {
		test(`preserves the graph structure`, function () {
			poset.sort();
			poset.populateDecendents();
			compareGraphStructure(nodes, edges, poset);
		})
		test(`enables isDescendent method`, function () {
			poset.sort();
			poset.populateDecendents();
			function secondArgIsADescendentOfFirstArg(a: number, b: number) {
				return poset.getNodeById(a).isDecendent(poset.getNodeById(b));
			}
			expect(secondArgIsADescendentOfFirstArg(7, 7)).toBe(true);
			expect(secondArgIsADescendentOfFirstArg(2, 3)).toBe(true);
			expect(secondArgIsADescendentOfFirstArg(6, 1)).toBe(true);
			expect(secondArgIsADescendentOfFirstArg(4, 6)).toBe(false);
		})
	})
})
describe(`DirectedTreeWithLeafs`, function () {
	test(`populates nodes with leafs that are reachable from it`, function () {
		const edges = [
			[5, 1], [5, 2], [6, 3], [6, 4], [7, 5], [7, 3], [8, 2], [8, 6], [9, 7], [9, 8]
		];
		const expectedLeafs = {
			1: [1],
			2: [2],
			3: [3],
			4: [4],
			5: [1, 2],
			6: [3, 4],
			7: [1, 2, 3],
			8: [2, 3, 4],
			9: [1, 2, 3, 4]
		};
		const poset = new DirectedTreeWithLeafs();
		posetFromEdges(poset, [
			[5, 1], [5, 2], [6, 3], [6, 4], [7, 5], [7, 3], [8, 2], [8, 6], [9, 7], [9, 8]
		])
		poset.populateLeafs();
		for (let id = 1; id < 10; id++) {
			expect(new Set(poset.getLeafsOfNode(id))).toEqual(new Set(expectedLeafs[id]));
		}
	})
})

