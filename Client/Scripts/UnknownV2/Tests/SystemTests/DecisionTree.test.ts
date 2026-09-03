import { describe, it, expect } from "vitest";
import {
    Branch, EvaluateDecisionTree, Leaf, MaxDecisionDepth, TraceDecisionTree, type DecisionNode
} from "../../Utilities/DecisionTree.ts";

/** A context with one dial per question the test trees ask. */
interface TestContext {
    thirsty : boolean
    tired : boolean
    threatened : boolean
}

const Context = (overrides : Partial<TestContext> = {}) : TestContext =>
    ({thirsty : false, tired : false, threatened : false, ...overrides});

/**
 * A predicate that counts how many times it was asked.
 *
 * Lazy evaluation is a documented guarantee rather than an accident of the
 * implementation, so it needs a test that can see the difference.
 */
function CountingPredicate(answer : boolean) {
    const record = {calls : 0};

    return {
        record : record,
        Predicate : (_context : TestContext) => {record.calls++; return answer}
    };
}

describe("evaluating a decision tree", () => {
    it("returns a lone leaf's result", () => {
        expect(EvaluateDecisionTree(Leaf("only", "Only"), Context())).toBe("only");
    });

    it("follows the true branch when the predicate holds", () => {
        const tree = Branch<TestContext, string>(
            "IsThirsty", (context) => context.thirsty,
            Leaf("drink", "Drink"), Leaf("graze", "Graze")
        );

        expect(EvaluateDecisionTree(tree, Context({thirsty : true}))).toBe("drink");
        expect(EvaluateDecisionTree(tree, Context({thirsty : false}))).toBe("graze");
    });

    it("walks nested branches to the right leaf", () => {
        const tree = Branch<TestContext, string>(
            "IsThreatened", (context) => context.threatened,
            Leaf("flee", "Flee"),
            Branch("IsTired", (context) => context.tired,
                Leaf("sleep", "Sleep"),
                Branch("IsThirsty", (context) => context.thirsty, Leaf("drink", "Drink"), Leaf("graze", "Graze"))
            )
        );

        expect(EvaluateDecisionTree(tree, Context({threatened : true, tired : true}))).toBe("flee");
        expect(EvaluateDecisionTree(tree, Context({tired : true}))).toBe("sleep");
        expect(EvaluateDecisionTree(tree, Context({thirsty : true}))).toBe("drink");
        expect(EvaluateDecisionTree(tree, Context())).toBe("graze");
    });

    it("asks only the questions on the path it takes", () => {
        // Load-bearing, not an optimisation: the member tree's predicates sample
        // the terrain noise field. An eager walk would probe ground to answer
        // questions the herd never asked, and the whole probe budget in
        // HerdConstants is calculated on the assumption that it does not.
        const taken = CountingPredicate(true);
        const notTaken = CountingPredicate(true);

        const tree = Branch<TestContext, string>(
            "Taken", taken.Predicate,
            Leaf("yes", "Yes"),
            Branch("NotTaken", notTaken.Predicate, Leaf("a", "A"), Leaf("b", "B"))
        );

        EvaluateDecisionTree(tree, Context());

        expect(taken.record.calls).toBe(1);
        expect(notTaken.record.calls).toBe(0);
    });

    it("asks each question on the path exactly once", () => {
        const first = CountingPredicate(false);
        const second = CountingPredicate(false);

        const tree = Branch<TestContext, string>(
            "First", first.Predicate,
            Leaf("a", "A"),
            Branch("Second", second.Predicate, Leaf("b", "B"), Leaf("c", "C"))
        );

        expect(EvaluateDecisionTree(tree, Context())).toBe("c");
        expect(first.record.calls).toBe(1);
        expect(second.record.calls).toBe(1);
    });

    it("throws rather than hanging on a cyclic tree", () => {
        // Trees built as literals cannot be cyclic. One assembled at runtime can,
        // and the alternative failure is a frozen tab with no stack trace.
        const cyclic = Branch<TestContext, string>(
            "Loops", () => true, Leaf("unreachable", "Unreachable"), Leaf("unreachable", "Unreachable")
        ) as {WhenTrue : DecisionNode<TestContext, string>};

        cyclic.WhenTrue = cyclic as unknown as DecisionNode<TestContext, string>;

        expect(() => EvaluateDecisionTree(cyclic as unknown as DecisionNode<TestContext, string>, Context()))
            .toThrow(/cyclic/);
    });

    it("evaluates a tree exactly at the depth limit", () => {
        // The cap must not reject a legitimately deep tree one branch short of it.
        let node : DecisionNode<TestContext, string> = Leaf("bottom", "Bottom");

        for (let depth = 0; depth < MaxDecisionDepth - 1; depth++) {
            node = Branch(`Level${depth}`, () => true, node, Leaf("side", "Side"));
        }

        expect(EvaluateDecisionTree(node, Context())).toBe("bottom");
    });

    it("carries results of any type, not only strings", () => {
        // The genericity claim. The herd tree returns numeric state values and the
        // member tree numeric actions, so a tree specialised to strings would be
        // useless to both.
        const weights = {separation : 3, cohesion : 0};
        const tree = Branch<TestContext, typeof weights>(
            "IsThreatened", (context) => context.threatened, Leaf(weights, "Scatter"), Leaf(weights, "Forage")
        );

        expect(EvaluateDecisionTree(tree, Context({threatened : true}))).toBe(weights);
    });

    it("serves two trees with different context types from one evaluator", () => {
        const numberTree = Branch<number, string>("IsPositive", (value) => value > 0, Leaf("up", "Up"), Leaf("down", "Down"));
        const stringTree = Branch<string, number>("IsEmpty", (value) => value.length === 0, Leaf(0, "Empty"), Leaf(1, "Full"));

        expect(EvaluateDecisionTree(numberTree, 5)).toBe("up");
        expect(EvaluateDecisionTree(stringTree, "abc")).toBe(1);
    });
});

describe("tracing a decision tree", () => {
    const tree = Branch<TestContext, string>(
        "IsThreatened", (context) => context.threatened,
        Leaf("flee", "Flee"),
        Branch("IsTired", (context) => context.tired,
            Leaf("sleep", "Sleep"),
            Branch("IsThirsty", (context) => context.thirsty, Leaf("drink", "Drink"), Leaf("graze", "Graze"))
        )
    );

    it("records every branch taken, in order, with its answer", () => {
        const {result, path} = TraceDecisionTree(tree, Context({thirsty : true}));

        expect(result).toBe("drink");
        expect(path).toEqual(["IsThreatened:false", "IsTired:false", "IsThirsty:true", "Drink"]);
    });

    it("records the leaf name last", () => {
        expect(TraceDecisionTree(tree, Context({threatened : true})).path).toEqual(["IsThreatened:true", "Flee"]);
    });

    it("agrees with the plain evaluator", () => {
        // Two walks of the same shape are two chances to disagree. A trace that
        // reported a path the evaluator would not have taken would be worse than
        // no trace at all.
        [
            Context(), Context({thirsty : true}), Context({tired : true}), Context({threatened : true}),
            Context({thirsty : true, tired : true, threatened : true})
        ].forEach((context) => {
            expect(TraceDecisionTree(tree, context).result).toBe(EvaluateDecisionTree(tree, context));
        });
    });

    it("names a lone leaf", () => {
        expect(TraceDecisionTree(Leaf("only", "Only"), Context()).path).toEqual(["Only"]);
    });
});
