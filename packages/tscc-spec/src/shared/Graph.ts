class AssociativeArrayLink<V> {
	public prev: this
	public next: this
	constructor(
		public value?: V
	) {
		this.prev = this;
		this.next = this;
	}
	insertBefore(item: this) {
		const prev = item.prev = this.prev;
		const next = item.next = this;
		next.prev = item;
		prev.next = item;
	}
	remove() {
		const prev = this.prev;
		const next = this.next;
		next.prev = prev;
		prev.next = next;
	}
}

class AssociativeArray<K, V> {
	private $keys: Map<K, AssociativeArrayLink<[K, V]>> = new Map();
	private $values: Map<V, AssociativeArrayLink<[K, V]>> = new Map();
	private pivot = new AssociativeArrayLink<any>();
	hasKey(key: K): boolean {
		return this.$keys.has(key);
	}
	hasValue(value: V): boolean {
		return this.$values.has(value)
	}
	getValue(key: K): V {
		let link = this.$keys.get(key);
		return link!.value![1];
	}
	getKey(value: V): K {
		let link = this.$values.get(value);
		return link!.value![0];
	}
	deleteKey(key: K): this {
		let link = this.$keys.get(key);
		if (!link) return this;
		this.$keys.delete(key);
		this.$values.delete(link.value![1]);
		link.remove();
		return this;
	}
	deleteValue(value: V): this {
		let link = this.$values.get(value);
		if (!link) return this;
		this.$keys.delete(link.value![0]);
		this.$values.delete(value);
		link.remove();
		return this;
	}
	set(key: K, value: V) {
		this.deleteKey(key);
		this.deleteValue(value);
		let link = new AssociativeArrayLink<[K, V]>([key, value]);
		this.$keys.set(key, link);
		this.$values.set(value, link);
		this.pivot.insertBefore(link);
	}
	get size() {
		return this.$keys.size;
	}
	keys() {
		return this.$keys.keys();
	}
	values() {
		return this.$values.keys();
	}
	*reversedKeys() {
		let link = this.pivot.prev;
		while (link !== this.pivot) {
			yield link.value[0];
			link = link.prev;
		}
	}
	*reversedValues() {
		let link = this.pivot.prev;
		while (link !== this.pivot) {
			yield link.value[1];
			link = link.prev;
		}
	}
	clear() {
		this.$keys.clear();
		this.$values.clear();
		this.pivot.next = this.pivot.prev = this.pivot;
	}
}

class Node {
	protected inbound: DirectedEdge[] = [];
	protected outbound: DirectedEdge[] = [];

	addInbound(edge: DirectedEdge) {
		this.inbound.push(edge);
	}
	addOutbound(edge: DirectedEdge) {
		this.outbound.push(edge);
	}
	deleteInbound(edge: DirectedEdge) {
		let i = this.inbound.indexOf(edge);
		if (i === -1) return;
		this.inbound.splice(i, 1);
	}
	deleteOutbound(edge: DirectedEdge) {
		let i = this.outbound.indexOf(edge);
		if (i === -1) return;
		this.outbound.splice(i, 1);
	}
	isRoot(): boolean {
		return this.inbound.length === 0;
	}
	isLeaf(): boolean {
		return this.outbound.length === 0;
	}
	iterateInboundEdges() {
		return this.inbound[Symbol.iterator]();
	}
	iterateOutboundEdges() {
		return this.outbound[Symbol.iterator]();
	}
	*iterateAncestors(): Generator<Node> {
		yield this;
		for (let inboundEdge of this.inbound) {
			yield* inboundEdge.source.iterateAncestors();
		}
	}
}

class NodeWithLeaf extends Node {
	protected inbound: DirectedEdge[] = [];
	protected outbound: DirectedEdge[] = [];

	protected leafs: Set<Node> = new Set();
	addLeaf(leaf: Node) {
		this.leafs.add(leaf);
	}
	getLeafs(): ReadonlyArray<Node> {
		return [...this.leafs];
	}
}

class DirectedEdge {
	constructor(
		public readonly source: Node,
		public readonly target: Node
	) {
		source.addOutbound(this);
		target.addInbound(this);
	}
}

class NodeToVisit extends Node {
	protected inbound: EdgeToVisit[] = [];
	protected outbound: EdgeToVisit[] = [];
	protected visitedOutbound: EdgeToVisit[] = [];
	protected decendents: Set<NodeToVisit> = new Set();

	setAsVisited(edge: EdgeToVisit) {
		let index = this.outbound.indexOf(edge);
		if (index !== -1) {
			this.outbound.splice(index, 1);
			this.visitedOutbound.push(edge);
		}
	}

	resetVisited() {
		Array.prototype.push.apply(this.outbound, this.visitedOutbound);
		this.visitedOutbound = [];
	}

	isDecendent(node: NodeToVisit) {
		return this.decendents.has(node);
	}

	collectDecendentsFromVisitedEdges() {
		this.decendents.add(this);
		for (let edge of this.visitedOutbound) {
			let target = edge.target;
			for (let decendent of target.decendents) {
				this.decendents.add(decendent);
			}
		}
	}
}

class EdgeToVisit extends DirectedEdge {
	constructor(
		public readonly source: NodeToVisit,
		public readonly target: NodeToVisit
	) {
		super(source, target);
	}

	setAsVisited() {
		this.source.setAsVisited(this);
	}
}

export class CycleError<I> extends Error {
	constructor(
		public cycle: IterableIterator<I>,
	) {super();}
}

export abstract class DirectedTreeBase<I, N extends Node, E extends DirectedEdge> {
	protected map: AssociativeArray<I, N> = new AssociativeArray();
	protected iterateNodes() {
		return this.map.values();
	}
	protected reverseIterateNodes() {
		return this.map.reversedValues();
	}
	protected abstract createNode(): N
	protected abstract createEdge(source?: N, target?: N): E

	addNodeById(id: I) {
		if (this.map.hasKey(id)) return;
		let node = this.createNode();
		this.map.set(id, node);
		return node;
	}
	addEdgeById(source: I, target: I) {
		this.createEdge(this.getNodeById(source), this.getNodeById(target));
	}
	getNodeById(id: I): N {
		if (this.map.hasKey(id)) return this.map.getValue(id);
		return <N>this.addNodeById(id);
	}
	getIdOfNode(node: Node): I {
		return this.map.getKey(<N>node);
	}
	protected static filterLeafs<N extends Node>(node: N): boolean {
		return node.isLeaf();
	}
	private getALeaf() {
		for (let node of this.iterateNodes()) {
			if (node.isLeaf()) return node;
		}
	}
	private getARoot() {
		for (let node of this.iterateNodes()) {
			if (node.isRoot()) return node;
		}
	}
	// Kahn's algorithm, sorting nodes from roots to leafs
	sort() {
		const size = this.map.size;
		const map = new AssociativeArray<I, N>();
		const out: I[] = [];
		let root: N;
		while (root = this.getARoot()!) {
			let id = this.getIdOfNode(root);
			map.set(id, root);
			out.push(id);
			this.map.deleteValue(root);
			for (let edge of root.iterateOutboundEdges()) {
				edge.target.deleteInbound(edge);
			}
		}
		if (map.size !== size) {
			throw new CycleError(this.map.keys());
		}
		// Reset deleted outbounds
		for (let node of map.values()) {
			for (let edge of node.iterateOutboundEdges()) {
				edge.target.addInbound(edge);
			}
		}
		this.map = map;
		return out;
	}
}

export class DirectedTree<I> extends DirectedTreeBase<I, Node, DirectedEdge> {
	protected createNode() {
		return new Node();
	}
	protected createEdge(source: Node, target: Node) {
		return new DirectedEdge(source, target);
	}
}

// Methods of this class is supposed to be called only after
// its nodes are topologically sorted leaf-to-node, in particular calling sort() shall not change anything
export class DirectedTreeWithOrdering<I> extends DirectedTreeBase<I, NodeToVisit, EdgeToVisit> {
	protected createNode() {
		return new NodeToVisit();
	}
	protected createEdge(source: NodeToVisit, target: NodeToVisit) {
		return new EdgeToVisit(source, target);
	}
	populateDecendents() {
		// Iterating over a topologically sorted nodes, from leafs to roots
		for (let node of this.reverseIterateNodes()) {
			node.collectDecendentsFromVisitedEdges();
			for (let edge of node.iterateInboundEdges()) {
				(edge as EdgeToVisit).setAsVisited();
			}
		}
		// reset
		for (let node of this.iterateNodes()) {
			node.resetVisited();
		}
	}
	getInfimum(idArray: I[]) {
		// Iterating over a topologically sorted nodes
		// Every edge goes from later nodes to earlier nodes.
		for (let node of this.reverseIterateNodes()) {
			if (idArray.every(id => node.isDecendent(this.getNodeById(id)))) {
				return this.getIdOfNode(node)!;
			}
		}
	}
}

export class DirectedTreeWithLeafs<I> extends DirectedTreeBase<I, NodeWithLeaf, DirectedEdge> {
	protected createNode() {
		return new NodeWithLeaf();
	}
	protected createEdge(source: NodeWithLeaf, target: NodeWithLeaf) {
		return new DirectedEdge(source, target);
	}
	private *iterateLeafs(): Generator<NodeWithLeaf> {
		for (let node of this.iterateNodes()) {
			if (node.isLeaf()) yield node;
		}
	}
	populateLeafs() {
		for (let leaf of this.iterateLeafs()) {
			for (let node of leaf.iterateAncestors()) {
				(node as NodeWithLeaf).addLeaf(leaf);
			}
		}
	}
	getLeafsOfNode(id: I): (I)[] {
		return this
			.getNodeById(id)
			.getLeafs()
			.map(this.getIdOfNode, this);
	}
}
