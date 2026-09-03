/**
 * A decision tree: a question, a subtree for each answer, and a result at the end.
 *
 * Deliberately tiny -- two node kinds and one evaluator. The value is not in what
 * it can express but in where the expressing happens: a tree built as a literal
 * puts the whole priority order of a behaviour on one screen, in reading order,
 * where changing what outranks what is moving a line rather than unpicking a chain
 * of ifs that grew in the order the features arrived.
 *
 * Generic over both the context asked about and the result returned, so the herd's
 * "which state" tree and a member's "which action" tree share one evaluator
 * instead of each growing their own.
 *
 * Not a behaviour tree. There are no sequences, no running state, no blackboard --
 * those solve a problem this does not have, which is behaviour that spans ticks.
 * A tree here is asked fresh every tick and answers immediately. Resist adding
 * node kinds; the moment a tree needs memory, the memory belongs in a component.
 */

/**
 * A cap on how many branches one walk may take before it is declared broken.
 *
 * Not defending against the trees in this file's callers, which are built as
 * literals and cannot contain a cycle. It defends against the next person who
 * builds one at runtime, where the alternative failure mode is a frozen tab with
 * no stack trace to explain it.
 */
export const MaxDecisionDepth = 32

/** A question asked of the context, with a subtree for each answer. */
export interface DecisionBranch<Context, Result> {
    readonly kind : "Branch"
    /**
     * What the question is, in words.
     *
     * Present so a tree can be traced rather than merely evaluated. The value a
     * tree returns says what was decided and only the path says why -- which is
     * the difference between a growing tree staying debuggable and becoming a
     * black box that returns the wrong answer for reasons nobody can see.
     */
    readonly name : string
    readonly Predicate : (context : Context) => boolean
    readonly WhenTrue : DecisionNode<Context, Result>
    readonly WhenFalse : DecisionNode<Context, Result>
}

/** An answer. The walk stops here. */
export interface DecisionLeaf<Result> {
    readonly kind : "Leaf"
    readonly name : string
    readonly result : Result
}

export type DecisionNode<Context, Result> = DecisionBranch<Context, Result> | DecisionLeaf<Result>

/**
 * Builds a branch.
 *
 * A helper rather than an object literal at every node so that a tree written out
 * reads as prose -- the question, then what happens if so, then what happens if
 * not -- instead of as four repeated field names per node.
 */
export function Branch<Context, Result>(
    name : string,
    Predicate : (context : Context) => boolean,
    WhenTrue : DecisionNode<Context, Result>,
    WhenFalse : DecisionNode<Context, Result>
) : DecisionBranch<Context, Result> {
    return {kind : "Branch", name : name, Predicate : Predicate, WhenTrue : WhenTrue, WhenFalse : WhenFalse}
}

/** Builds a leaf. `name` defaults to nothing useful on purpose -- name your leaves. */
export function Leaf<Result>(result : Result, name : string) : DecisionLeaf<Result> {
    return {kind : "Leaf", name : name, result : result}
}

/**
 * Walks `root` down to a leaf and returns its result.
 *
 * Predicates are evaluated lazily -- only the ones on the path actually taken.
 * That is load-bearing rather than an optimisation: the member tree's predicates
 * sample the terrain noise field, and an eager walk would pay for probing ground
 * to answer questions the herd never got round to asking.
 */
export function EvaluateDecisionTree<Context, Result>(
    root : DecisionNode<Context, Result>, context : Context
) : Result {
    let node : DecisionNode<Context, Result> = root

    for (let depth = 0; depth < MaxDecisionDepth; depth++) {
        if (node.kind === "Leaf") return node.result

        node = node.Predicate(context) ? node.WhenTrue : node.WhenFalse
    }

    throw new Error(`Decision tree exceeded ${MaxDecisionDepth} branches; it is probably cyclic.`)
}

/**
 * The same walk, recording which branches were taken and what each one answered.
 *
 * For tests and for diagnosis. A test asserting only on the result cannot tell a
 * tree that reached Migrate because the herd was thirsty from one that reached it
 * because a threat check was wired backwards -- both return Migrate, and only one
 * of them is right.
 */
export function TraceDecisionTree<Context, Result>(
    root : DecisionNode<Context, Result>, context : Context
) : {result : Result, path : readonly string[]} {
    const path : string[] = []

    let node : DecisionNode<Context, Result> = root

    for (let depth = 0; depth < MaxDecisionDepth; depth++) {
        if (node.kind === "Leaf") {
            path.push(node.name)

            return {result : node.result, path : path}
        }

        const answer = node.Predicate(context)

        path.push(`${node.name}:${answer}`)

        node = answer ? node.WhenTrue : node.WhenFalse
    }

    throw new Error(`Decision tree exceeded ${MaxDecisionDepth} branches; it is probably cyclic.`)
}
