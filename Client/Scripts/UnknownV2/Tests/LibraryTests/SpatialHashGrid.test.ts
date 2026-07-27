import { describe, it, expect } from "vitest";
import { SpatialHashGrid } from "../../Libraries/Spatial/SpatialHashGrid.ts";

/** Sorted so assertions do not depend on cell traversal order. */
const Sorted = (items : string[]) => [...items].sort();

describe("construction", () => {
  it("rejects a zero cell size", () => expect(() => new SpatialHashGrid<string>(0)).toThrow(RangeError));
  it("rejects a negative cell size", () => expect(() => new SpatialHashGrid<string>(-4)).toThrow(RangeError));
  it("rejects a non-finite cell size", () => expect(() => new SpatialHashGrid<string>(NaN)).toThrow(RangeError));

  it("exposes the cell size", () => expect(new SpatialHashGrid<string>(8).CellSize).toBe(8));
  it("starts empty", () => expect(new SpatialHashGrid<string>(8).Size).toBe(0));
});

describe("insertion", () => {
  it("finds an inserted item", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);

    expect(grid.QueryRadius(5, 5, 1)).toEqual(["a"]);
  });

  it("re-inserting relocates rather than duplicating", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);
    grid.Insert("a", 95, 95);

    expect(grid.Size).toBe(1);
    expect(grid.QueryRadius(5, 5, 1)).toEqual([]);
    expect(grid.QueryRadius(95, 95, 1)).toEqual(["a"]);
  });

  it("holds many items in one cell", () => {
    const grid = new SpatialHashGrid<string>(100);
    grid.Insert("a", 1, 1).Insert("b", 2, 2).Insert("c", 3, 3);

    expect(Sorted(grid.QueryRectangle(0, 0, 100, 100))).toEqual(["a", "b", "c"]);
  });
});

describe("removal", () => {
  it("removes a present item", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);

    expect(grid.Remove("a")).toBe(true);
    expect(grid.Size).toBe(0);
    expect(grid.QueryRadius(5, 5, 100)).toEqual([]);
  });

  it("reports false for an absent item", () => expect(new SpatialHashGrid<string>(10).Remove("ghost")).toBe(false));

  it("removing one item leaves its cellmates", () => {
    const grid = new SpatialHashGrid<string>(100);
    grid.Insert("a", 1, 1).Insert("b", 2, 2);
    grid.Remove("a");

    expect(grid.QueryRectangle(0, 0, 100, 100)).toEqual(["b"]);
  });

  it("Clear empties the grid", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5).Insert("b", 500, 500);
    grid.Clear();

    expect(grid.Size).toBe(0);
    expect(grid.QueryRectangle(-1000, -1000, 1000, 1000)).toEqual([]);
  });
});

describe("movement", () => {
  it("moving within a cell keeps the item findable", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 1, 1);
    grid.Move("a", 9, 9);

    expect(grid.GetPosition("a")).toEqual({x: 9, y: 9});
    expect(grid.QueryRadius(9, 9, 0.5)).toEqual(["a"]);
    expect(grid.QueryRadius(1, 1, 0.5)).toEqual([]);
  });

  it("moving across cells re-buckets the item", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);
    grid.Move("a", -35, 72);

    expect(grid.Size).toBe(1);
    expect(grid.QueryRadius(5, 5, 1)).toEqual([]);
    expect(grid.QueryRadius(-35, 72, 1)).toEqual(["a"]);
  });

  it("Move inserts an unknown item", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Move("a", 5, 5);

    expect(grid.Has("a")).toBe(true);
  });

  it("a long walk does not accumulate stale entries", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 0, 0);

    for (let step = 1; step <= 500; step++) grid.Move("a", step * 10, 0);

    expect(grid.Size).toBe(1);
    expect(grid.QueryRectangle(-10000, -10000, 10000, 10000)).toEqual(["a"]);
  });
});

describe("position bookkeeping", () => {
  it("returns undefined for an absent item", () =>
    expect(new SpatialHashGrid<string>(10).GetPosition("ghost")).toBeUndefined());

  it("hands back a copy, so mutating it cannot corrupt the index", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);

    const position = grid.GetPosition("a")!;
    position.x = 9999;

    expect(grid.GetPosition("a")).toEqual({x: 5, y: 5});
    expect(grid.QueryRadius(5, 5, 1)).toEqual(["a"]);
  });
});

describe("rectangle queries", () => {
  const Build = () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("origin", 0, 0)
        .Insert("near", 4, 4)
        .Insert("edge", 10, 10)
        .Insert("far", 250, 250)
        .Insert("negative", -25, -25);
    return grid;
  };

  it("includes items strictly inside", () => expect(Build().QueryRectangle(-1, -1, 5, 5)).toContain("near"));
  it("includes items on the boundary", () => expect(Build().QueryRectangle(0, 0, 10, 10)).toContain("edge"));
  it("excludes items outside", () => expect(Build().QueryRectangle(-1, -1, 5, 5)).not.toContain("far"));

  it("handles negative coordinates", () =>
    expect(Build().QueryRectangle(-30, -30, -20, -20)).toEqual(["negative"]));

  it("normalizes swapped corners", () =>
    expect(Sorted(Build().QueryRectangle(5, 5, -1, -1))).toEqual(Sorted(Build().QueryRectangle(-1, -1, 5, 5))));

  it("a zero-area rectangle finds an exact hit", () =>
    expect(Build().QueryRectangle(0, 0, 0, 0)).toEqual(["origin"]));

  it("returns nothing for an empty region", () =>
    expect(Build().QueryRectangle(1000, 1000, 2000, 2000)).toEqual([]));

  it("never returns duplicates when spanning many cells", () => {
    const grid = new SpatialHashGrid<number>(10);
    for (let i = 0; i < 200; i++) grid.Insert(i, i * 3, i * 3);

    const found = grid.QueryRectangle(-1000, -1000, 1000, 1000);

    expect(found.length).toBe(new Set(found).size);
    expect(found.length).toBe(200);
  });
});

describe("radius queries", () => {
  it("returns an exact circle, not the cell bounding box", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("inside", 3, 0);
    // Sits in a cell the query's bounding box overlaps, but is 5.66 away.
    grid.Insert("corner", 4, 4);

    expect(grid.QueryRadius(0, 0, 5)).toEqual(["inside"]);
  });

  it("includes an item exactly on the radius", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 3, 4);

    expect(grid.QueryRadius(0, 0, 5)).toEqual(["a"]);
  });

  it("a zero radius finds only an exact hit", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5).Insert("b", 5.001, 5);

    expect(grid.QueryRadius(5, 5, 0)).toEqual(["a"]);
  });

  it("a negative radius finds nothing", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 5, 5);

    expect(grid.QueryRadius(5, 5, -1)).toEqual([]);
  });

  it("spans many cells when the radius is large", () => {
    const grid = new SpatialHashGrid<string>(4);
    grid.Insert("a", -50, -50).Insert("b", 0, 0).Insert("c", 50, 50);

    expect(Sorted(grid.QueryRadius(0, 0, 100))).toEqual(["a", "b", "c"]);
  });

  it("agrees with a brute-force scan", () => {
    const grid = new SpatialHashGrid<number>(16);
    const points : {x : number, y : number}[] = [];

    // Deterministic pseudo-random spread, so a failure is reproducible.
    let state = 12345;
    for (let i = 0; i < 400; i++) {
      state = (state * 1103515245 + 12345) % 2147483648;
      const x = (state % 1000) - 500;
      state = (state * 1103515245 + 12345) % 2147483648;
      const y = (state % 1000) - 500;

      points.push({x, y});
      grid.Insert(i, x, y);
    }

    const radius = 60;
    const expected = points
      .map((point, index) => ({point, index}))
      .filter(({point}) => Math.hypot(point.x - 10, point.y - 10) <= radius)
      .map(({index}) => index);

    expect(Sorted(grid.QueryRadius(10, 10, radius).map(String))).toEqual(Sorted(expected.map(String)));
  });
});

describe("traversal", () => {
  it("ForEach visits every item with its position", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 1, 2).Insert("b", 30, 40);

    const seen : string[] = [];
    grid.ForEach((item, x, y) => {seen.push(`${item}:${x},${y}`)});

    expect(Sorted(seen)).toEqual(["a:1,2", "b:30,40"]);
  });

  it("ForEachInRadius reports the item's own position", () => {
    const grid = new SpatialHashGrid<string>(10);
    grid.Insert("a", 3, 4);

    const seen : string[] = [];
    grid.ForEachInRadius(0, 0, 10, (item, x, y) => {seen.push(`${item}:${x},${y}`)});

    expect(seen).toEqual(["a:3,4"]);
  });

  it("ForEach on an empty grid does nothing", () => {
    let calls = 0;
    new SpatialHashGrid<string>(10).ForEach(() => {calls++});

    expect(calls).toBe(0);
  });
});

describe("cell size independence", () => {
  // The same points and the same query must give the same answer regardless of
  // how the world happens to be bucketed.
  const points : [string, number, number][] = [
    ["a", 0, 0], ["b", 7, 7], ["c", -13, 22], ["d", 101, -4], ["e", 55, 55],
  ];

  const QueryWith = (cellSize : number) => {
    const grid = new SpatialHashGrid<string>(cellSize);
    for (const [item, x, y] of points) grid.Insert(item, x, y);
    return Sorted(grid.QueryRadius(5, 5, 60));
  };

  it("cell size 1 matches cell size 1000", () => expect(QueryWith(1)).toEqual(QueryWith(1000)));
  it("cell size 3 matches cell size 64", () => expect(QueryWith(3)).toEqual(QueryWith(64)));
  it("a fractional cell size behaves the same", () => expect(QueryWith(0.5)).toEqual(QueryWith(64)));
});
