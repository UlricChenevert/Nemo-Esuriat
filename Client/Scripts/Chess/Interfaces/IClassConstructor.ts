// `any[]` for args (not `unknown[]`) so classes with typed constructor params
// (e.g. `new Position(x: number, y: number)`) are assignable — this type is used
// purely as a class token, never to construct with args. ClassType stays fully typed.
export type IClassConstructor<ClassType> = new (...args : any[]) => ClassType