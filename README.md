# 👆 Drag Select for React Native

<pre></pre>

A utility for creating a pan gesture that auto-selects items in a list, like your favorite gallery app.

- Android & iOS
- Handles scrolling
- Super performant
- Flexible API
- Works with typical scrollable views - tested with [`ScrollView`](https://reactnative.dev/docs/scrollview), [`FlatList`](https://reactnative.dev/docs/flatlist) and [`FlashList`](https://shopify.github.io/flash-list/).

> [!IMPORTANT]
> This package is in public alpha. API breaking changes may occur until v1.0.0
>
> <strong>Feedback wanted!</strong><br/>
> Is your use case [not supported?](#currently-not-supported) Something not working as expected? Please submit an issue if no similar issue exists.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [API](#api)
- [Recipes](#recipes)
- [Currently Not Supported](#currently-not-supported)
- [Development](#development)

## Quick Start

```tsx
import { useDragSelect } from "@osamaqarem/react-native-drag-select"
import { View, Text } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
} from "react-native-reanimated"

function List() {
  const data = [{ id: "usr_123", name: "foo" }]

  const flatlist = useAnimatedRef()

  const { gestures, onScroll } = useDragSelect({
    data,
    key: "id",
    list: {
      numColumns: 1,
      columnSeparatorWidth: 0,
      rowSeparatorHeight: 0,
      animatedRef: flatlist,
      itemSize: { height: 50, width: 50 },
    },
  })

  const scrollHandler = useAnimatedScrollHandler(onScroll)

  return (
    <GestureDetector gesture={gestures.panHandler}>
      <Animated.FlatList
        data={data}
        numColumns={1}
        onScroll={scrollHandler}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <GestureDetector gesture={gestures.createItemPressHandler(item)}>
            <View style={{ width: 50, height: 50 }}>
              <Text>{item.id}</Text>
            </View>
          </GestureDetector>
        )}
      />
    </GestureDetector>
  )
}
```

## Installation

This package requires [Reanimated v3](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#installation) and [Gesture Handler v2](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/).

```sh
npm install @osamaqarem/react-native-drag-select
```

```sh
yarn add @osamaqarem/react-native-drag-select
```

```sh
pnpm add @osamaqarem/react-native-drag-select
```

## API

```ts
import { useDragSelect } from "@osamaqarem/react-native-drag-select"
```

### Hooks

Provide configuration to `useDragSelect` describing the UI of your list. This config is used to calculate a virtual representation of the items on screen.

#### `useDragSelect(config)`

<details>
<summary>

##### `config` _(click to expand)_

</summary>

```ts
interface Config<ListItem> {
  /**
   * The same array of items rendered on screen in a scrollable view.
   */
  data: Array<ListItem>
  /**
   * Key or path to key which uniquely identifies an item in the list.
   *
   * @example
   * // Full code omitted for brevity.
   * const item = { id: "usr_123", name: "foo" }
   * useDragSelect({ key: "id" })
   */
  key: PropertyPaths<ListItem>
  list: {
    /**
     * An [animated ref](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedRef) to
     * the scrollable view where the items are rendered.
     *
     * @example
     * // Full code omitted for brevity.
     * const animatedRef = useAnimatedRef()
     * useDragSelect({ list: { animatedRef } })
     * return <Animated.FlatList ref={animatedRef} />
     */
    animatedRef: AnimatedRef<any>
    /**
     * Number of columns in the list.
     */
    numColumns: number
    /**
     * Amount of horizontal space between items.
     */
    rowSeparatorHeight: number
    /**
     * Amount of vertical space between items.
     */
    columnSeparatorWidth: number
    /**
     * The height and width of each item in the list.
     */
    itemSize: {
      width: number
      height: number
    }
  }
  /**
   * Configuration for the long press gesture.
   * Used to enter 'select mode' by long pressing an item.
   */
  longPressGesture?: {
    /**
     * Whether long pressing to activate 'select mode' is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * The amount of time in milliseconds an item must be pressed before 'select mode' activates.
     * @default 300
     */
    minDurationMs?: number
  }
  /**
   * Configuration for automatic scrolling while panning gesture.
   */
  panScrollGesture?: {
    /**
     * Whether pan-scrolling is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * How close should the pointer be to the start of the list before **inverse** scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list.
     * @default 0.15
     */
    startThreshold?: number
    /**
     * How close should the pointer be to the end of the list before scrolling begins.
     * A value between 0 and 1 where 1 is equal to the height of the list.
     * @default 0.85
     */
    endThreshold?: number
    /**
     * The maximum scrolling speed when the pointer is near the starting edge of the list window.
     * Must be higher than 0.
     * @default 8
     */
    startMaxVelocity?: number
    /**
     * The maximum scrolling speed when the pointer is at the ending edge of the list window.
     * Must be higher than 0.
     * @default 8
     */
    endMaxVelocity?: number
  }
  /**
   * Invoked on the JS thread whenever an item is tapped, but not added to selection.
   * Use this instead of an `onPress` prop on list items.
   * @param {ListItem} item - The item that was tapped.
   */
  onItemPress: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   * @param {ListItem} item - The item that was selected.
   */
  onItemSelected: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   * @param {ListItem} item - The item that was deselected.
   */
  onItemDeselected: (item: ListItem) => void
}
```

</details>

#### Returns `{ selection, gestures, onScroll }`

##### `selection`

```ts
interface Selection {
  active: Readonly<SharedValue<boolean>>
  add: (id: string) => void
  clear: () => void
  delete: (id: string) => boolean
  has: (id: string) => boolean
  size: Readonly<SharedValue<number>>
}
```

An imperative API to manage selection state. Methods must be invoked from the JS thread.

##### `gestures.panHandler`

```tsx
<GestureDetector gesture={gestures.panHandler}>
  <Animated.FlatList />
</GestureDetector>
```

This is a single [pan gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture). If you prefer to rely on tapping items for selection, you can disable the pan gesture by setting `config.panScrollGesture.enabled` to `false`.

##### `gestures.createItemPressHandler`

```tsx
<Animated.FlatList
  renderItem={({ item }) => {
    return (
      <GestureDetector gesture={gestures.createItemPressHandler(item)}>
        <View style={styles.item}>
          <Text>{item.id}</Text>
        </View>
      </GestureDetector>
    )
  }}
/>
```

This is a composed [tap](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture) & [long-press](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/long-press-gesture) gesture. Note that the long press gesture can be disabled by setting `config.longPressGesture.enabled` to `false`.

> [!NOTE]
> You can still [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/gesture#gesturesimultaneousgesture1-gesture2-gesture3--composedgesture) with your own gestures freely.
>
> ```ts
> const gesture = gestures.createItemPressHandler(item)
> const tapGesture = Gesture.Tap()
> const composed = Gesture.Simultaneous(gesture, tapGesture)
> ```

##### `onScroll`

```tsx
const scrollHandler = useAnimatedScrollHandler(onScroll)
return <Animated.FlatList onScroll={scrollHandler} />
```

Must be passed to the animated list to use the pan-scroll gesture. Used to obtain scroll offset and list window size.

## Recipes

TODO

## Currently Not Supported

- Lists with dynamic item size.
- Horizontal lists.
- Inverted lists.
- Section lists.

Inverted & horizontal lists would be easy to support. Other types are much more tricky and might require API breaking changes.

## Development

This project uses [pnpm](https://pnpm.io/installation).

```sh
pnpm install
pnpm dev ios
```

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
