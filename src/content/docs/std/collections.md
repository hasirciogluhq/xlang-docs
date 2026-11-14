---
title: Collections
---

The standard library has one collection: `Vec<T>`, a growable array in `std/collections`.

```xlang
from "std" import Vec, println

@entry fn main() -> i32 {
    local v: Vec<i64> = Vec<i64>()
    v.push(10)
    v.push(20)
    v.push(30)
    println("length {}", v.length())
    println("first {}", *v.first())
    println("last {}", *v.last())
    v.set(1, 25)
    println("after set {}", *v.get(1))
    return 0
}
```

## Storage and ownership

- `Vec<T>` stores its elements **bitwise in slots**, in memory allocated through `currentAllocator`.
- The `Vec` owns the elements below its length, and each one is dropped exactly once: when it is replaced, removed or truncated, and when the `Vec` itself is dropped.
- `get`, `first` and `last` return a **pointer** to an element, so reading an element never copies it. `first` and `last` panic when the `Vec` is empty.
- `set` drops the old element and stores the new one. `push`, `insert` and `set` take their value **by move**.
- `pop`, `remove` and `swapRemove` return the removed element **by value**, so the caller owns it and drops it.
- Growth allocates `max(needed, 2 * capacity, 4)` slots and moves the existing elements into them.

## API

| Method | Meaning |
|---|---|
| `init()` | an empty `Vec`, no allocation |
| `length()`, `capacity()`, `isEmpty()` | size, allocated slots, emptiness |
| `get(i)`, `first()`, `last()` | a pointer to an element |
| `set(i, v)` | replace element `i`, dropping the old one |
| `push(v)` | append |
| `pop()` | remove and return the last element |
| `insert(i, v)`, `remove(i)`, `swapRemove(i)` | insert before `i`; remove at `i` keeping order; remove at `i` by swapping in the last element |
| `truncate(n)`, `clear()` | keep the first `n` elements; remove all |
| `reserve(n)` | ensure room for `n` elements |
| `retain(keep)` | keep the elements for which `keep(*T)` is true, in order, and drop the others; `keep` is a function or a closure: `v.retain(\|x\| *x > 0)` |
| `iter()` | the `VecIter<T>` behind `for x in v` and `for x, i in v`; each round yields a `*T` into the `Vec`, so `*x += 1` writes the element |

`v.clone()` returns an independent `Vec<T>` with the same elements in the same order. An element type that needs no drop is copied bitwise; an element type that needs drop is copied with the element's own `clone(self) -> T`, so the two vectors never share an element. The method is lowered only for the element types it is called with, so a `Vec` of a droppable type without `clone` is fine as long as it is not cloned.

## Panics

An index outside the elements panics with `Vec: index I out of range for length L`. `pop` on an empty `Vec` panics with `Vec: pop from empty vec`, and `first`/`last` with `Vec: first of empty vec` / `Vec: last of empty vec`.

## Sum types: `Option<T>` and `Result<T, E>`

`std/collections` also holds the two standard sum types. Both are ordinary generic payload enums, so a `switch` over
their variants is exhaustive and the live payload is dropped exactly once.

```xlang
from "std/collections/option" import Option
from "std/collections/result" import Result

enum Option<T> {
    None
    Some(T)
}

enum Result<T, E> {
    Ok(T)
    Err(E)
}
```

There is no need to write the early exit out by hand:

```xlang
local r: Result<i32, MyErr> = step()
local v: i32 = r?
```

`?` on a `Result` exits the caller with `Err(e)`; on an `Option` it exits with `None`.

`Option<T>` has `isSome`, `isNone`, `unwrap`, `expect(msg)`, `unwrapOr(fallback)`, `map(f)`, `andThen(f)`
and `okOr(err)`; `Result<T, E>` has `isOk`, `isErr`, `unwrap`, `expect(msg)`, `unwrapOr(fallback)`,
`unwrapErr`, `map(f)`, `andThen(f)`, `mapErr(f)`, `okOption()` and `errOption()`, plus `takeOk`/`takeErr`,
which write the payload through an `out` pointer and return whether that variant was live.
`isSome`, `isNone`, `isOk` and `isErr` borrow the value, so testing a payload that needs drop does not
drop it.

## `Vec` and slice algorithms

`Vec<T>` also carries the usual sequence algorithms:

| Method | Meaning |
|---|---|
| `reverse()` | reverse in place |
| `sort()` | stable ascending sort by the element's `fn <` |
| `sortBy(cmp)` | stable sort by `fn(*T, *T) -> i32`, negative when the first is smaller |
| `binarySearch(v)`, `binarySearchBy(cmp)` | the index of `v` in a sorted vector, or `None` |
| `contains(v)`, `containsBy(pred)` | whether an element matches |
| `indexOf(v)`, `indexOfBy(pred)` | the index of the first match, or `None` |
| `dedup()`, `dedupBy(eq)` | drop each element equal to the one before it |
| `retain(keep)` | keep the elements for which `keep(*T)` is true |

A plain element type (`i32`, a struct with no drop) uses the short forms. A droppable element type
(`String`, a `class`) uses the `…By` forms with a borrowed comparator, because `fn ==` and `fn <` take
their operands **by value** and free them: `strs.sortBy(str/string.compareString)` orders a
`Vec<String>` without moving any element out. The `…By` variants are also what a type with no operator
of its own uses.

`std/collections/slice` has the same operations for a `[]T`/`[]mut T`: `reverseSlice`, `sortSlice`,
`binarySearchSlice`, `containsSlice`, `indexOfSlice`, `indexOfBySlice`, `dedupSlice`. Pass the type
argument explicitly (`sortSlice<i32>(a)`), because a generic parameter is not inferred from a slice.

## Iterators

`std/collections/iter` holds the adaptors a `for` loop builds on: `mapIter`, `filterIter`,
`enumerateIter`, `zipIter` and `collect<T, I>(it)`, which drains an adaptor into a `Vec<T>`. Each
adaptor is a small struct with `next()`, so an iterator chain is a stack of structs, not a closure.

## Hash tables: `HashMap`, `HashSet`

`HashMap<K, V>` and `HashSet<T>` live in `std/collections/hashmap` and `std/collections/hashset`.
A key type implements the `HashKey` interface from `std/collections/hash`: `hashKey(seed)` folds the
key into a running hash, and `equalsKey(other)` compares it. The stdlib ships `I32Key`, `U64Key`,
`I64Key` and `String` as key types, because the language cannot implement an interface on a primitive.

```xlang
from "std/collections/hashmap" import HashMap
from "std/collections/hash" import I32Key

local m: HashMap<I32Key, i32> = HashMap<I32Key, i32>()
m.put(I32Key { v: 1 }, 10)
if m.get(I32Key { v: 1 }).isSome() { /* ... */ }
```

The default hasher is SipHash-1-3 with a random per-map seed (`std/collections/hash.siphash13`),
which resists the collision attack that makes a fixed hash a denial-of-service risk. `std/checksum`
keeps FNV, Adler-32 and CRC-32 for error detection; those are not for table keys.

Both types grow by doubling and probe linearly. `for kv in map` yields `(*K, *V)` and
`for k in set` yields `*T`; the order is the slot order, so it is **not** stable between inserts.

## Ordered and double-ended containers

| Type | Module | Order | Cost |
|---|---|---|---|
| `Deque<T>` | `std/collections/deque` | front or back | `O(1)` at either end |
| `BinaryHeap<T>` | `std/collections/binaryheap` | greatest first | `O(log n)` push and pop |
| `BTreeMap<K, V>` | `std/collections/btreemap` | key order | `O(log n)` lookup, `O(n)` insert |

`Deque` is a ring buffer: `pushBack`/`pushFront` and `popBack`/`popFront` all cost `O(1)`, with one
`O(n)` copy when it doubles. `BinaryHeap` is a max-heap and takes its comparator in `init`, so it
works for any element type: `BinaryHeap<i32>(cmp)`. `BTreeMap` keeps its entries sorted by a
comparator and iterates in key order, which is the reason to pick it over `HashMap` when the output
must be deterministic.

All three take a `fn(*T, *T) -> i32` comparator rather than relying on `fn <`, so a droppable key or
element works.

## Owned pointers: `Box`, `Rc`, `Arc`

| Type | Module | Owners | Free style |
|---|---|---|---|
| `Box<T>` | `std/collections/box` | one | `boxOf(v)`, `get`, `take` |
| `Rc<T>` | `std/collections/rc` | many, one thread | `rcOf(v)`, `clone`, `strongCount` |
| `Arc<T>` | `std/collections/arc` | many, any thread | `arcOf(v)`, `clone`, `strongCount` |

`Box` is a single owned heap value: `boxOf(v)` moves `v` onto the heap, `get()` borrows it, and
`take()` moves it back out. `Rc` and `Arc` keep a reference count beside the value in one heap block;
the last handle drops the value and frees the block. `Rc` uses a plain count and is single-threaded;
`Arc` uses the atomic builtins (`__builtin_atomicAdd` with `MemoryOrder.acqRel`) and may be cloned
and dropped from any thread.
