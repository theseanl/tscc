export interface ISourceNode {
	readonly fileName: string
	readonly provides: string[]
	readonly required:string[] 
	readonly forwardDeclared:string[]
}

