///<reference types="jest"/>
import ClosureDependencyGraph from '../../src/graph/ClosureDependencyGraph'
import {ISourceNode} from '../../src/graph/ISourceNode';

describe(`ClosureDependencyGraph`, () => {
	describe(`getSortedFilesAndFlags`, () => {
		test(`includes transitive type-references`, () => {
			const nodes: ISourceNode[] = [
				{
					fileName: '0',
					provides: ['z'],
					required: ['a'],
					forwardDeclared: ['a']
				},
				{
					fileName: '1',
					provides: ['a'],
					required: [],
					forwardDeclared: ['b']
				},
				{
					fileName: '2',
					provides: ['b'],
					required: [],
					forwardDeclared: ['c']
				},
				{
					fileName: '3',
					provides: ['c'],
					required: [],
					forwardDeclared: []
				}
			];
			const graph = new ClosureDependencyGraph();
			nodes.forEach(node => graph.addSourceNode(node));
			const {src} = graph.getSortedFilesAndFlags([
				{
					moduleName: 'moduleName',
					moduleId: 'z',
					dependencies: [],
					extraSources: []
				}
			]);
			expect(src.length).toBe(4);
		})
	})

})
