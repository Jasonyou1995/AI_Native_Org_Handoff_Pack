# Organization Topology Spec v0.1

Status: draft, nothing built yet. License intent: Apache-2.0.
Companion to `MSG-DESIGN-SPEC.md` and `COORDINATION-COST-SPEC.md`. This one defines the organization the agents work in.

## One sentence

Four topologies, three scales, one job: decide how work flows between agents so that the effect of message design can be separated from the effect of structure.

## Why topology is a variable

Message design and organization shape are confounded by default. If structure helps, is it because a structured message is better, or because it helps more when there are eight agents than when there are eight hundred? Without varying both, H5 (superlinear scale effect) is untestable and H1 is uninterpretable.

Topology is therefore a controlled variable, not a background detail.

## The four topologies

Ids are exactly `chain`, `tree`, `hub-and-spoke`, `mesh`. These strings are what the runner writes into every result row, so they must not be abbreviated anywhere. The ASCII diagrams below use `hub` for width only.

### chain

```
A → B → C → D → ... → Z
```

Strictly sequential. Handoff depth equals `N - 1`. Each agent hands to exactly one successor.

Purpose: isolates message cost with no coordination noise. This is the cleanest condition and the baseline.

### tree

```
        root
      /  |  \
     a   b   c          depth = log(N)
    / \ / \  / \
   ...        ...
```

Hierarchical. Each node reports to one parent, supervises `k` children.

Purpose: the realistic organizational case. Information degrades with depth, which is where H5 should bite hardest.

### hub-and-spoke

```
   a   b   c   d
    \  |  |  /
       hub
    /  |  |  \
   e   f   g   h
```

One coordinator, `N - 1` workers. All handoffs route through the hub.

Purpose: the common production pattern, and the worst case for information loss, since the hub is a single point of both context loss and latency.

### mesh

```
  a ←→ b ←→ c
  ↑ ↘  ↓ ↙  ↑
  d ←→ e ←→ f
```

Every agent can reach every other. Unbounded routing.

Purpose: upper bound on reachable information, lower bound on coordination overhead. Most likely to show H3, because in a mesh no agent needs a contract to know what it may do.

## Scales

| N | Meaning | Purpose |
|---|---|---|
| 8 | small team, roughly one person per function | establishes the low end of the scale curve |
| 32 | department | the operating range most products actually run in |
| 96 | division | the regime the paper claims superlinear growth for |

N = 96 is where "a few hundred agent employees" becomes real without the cost of N = 300. If the scale effect is genuine it must be visible between 32 and 96. If it is not, the paper's H5 fails and that is a finding, not a bug to tune away.

## Rules

1. **Same work in every topology.** The total task must be identical across topologies, only the routing differs. A topology that gets less work will always look cheaper.
2. **No topology is allowed a shortcut.** In particular the hub may not inspect the receiver's workspace directly. It relays messages like everyone else, or the topology is cheating.
3. **Topology is declared, not emergent.** No agent invents a new reporting line. Emergent topology is a different study and a different paper.
4. **The topology is fixed for the whole run.** Mid-run reorganization destroys the nesting the statistical model assumes.
5. **Roles are assigned by position, not by name.** Agent `a3` is the third leaf in every topology, so cross-topology comparison is well defined.

## What each topology is expected to show

Stated as predictions to be tested, not conclusions:

| | chain | tree | hub-and-spoke | mesh |
|---|---|---|---|---|
| `handoff_depth` | N-1 | log(N) | 2 | 1 |
| expected `C_search` | highest, depth accumulates | moderate | lowest for workers, highest at hub | lowest |
| expected `C_adapt` | lowest, no renegotiation | moderate | highest at the hub | lowest |
| where H3 should appear | never, over-contracting a chain is pure cost | moderately | strongly, the hub is the classic principal-agent gap | never, information is already free |

If the measured pattern is flat across topologies, the honest conclusion is that message design does not interact with organization shape. That is publishable. A flat result that gets quietly rewritten as a positive one is not.

## Cost of running at scale

N = 96 under the hub topology with `handoff_rounds` per worker produces more model calls than the entire rest of the matrix. The runner must therefore:

- report projected cost per cell before running it, and refuse to start a cell that would breach `--max-spend`
- run the cheapest cells first, so a budget breach lands on the least informative cells
- checkpoint every run, so an interrupted grid resumes rather than restarts

## References

- `MSG-DESIGN-SPEC.md` : the design axis held constant across topologies
- `COORDINATION-COST-SPEC.md` : `handoff_depth`, `handoff_latency_ms`, `blocked_ms`
- `../docs/02-实验设计.md` : the full matrix, seeds, preregistration
- `../docs/00-总体规划.md` : H5, the scale effect this spec exists to make testable