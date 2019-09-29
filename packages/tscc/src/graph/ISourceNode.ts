export interface ISourceNode {
	readonly fileName: string
	readonly provides: ReadonlyArray<string>
	readonly required: ReadonlyArray<string>
	readonly forwardDeclared: ReadonlyArray<string>
}

