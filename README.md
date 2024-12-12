# 👆 Drag Select for React Native

<p align="center">
  <img src="./docs/assets/hero.gif" width="500px" />
</p>

A utility for creating a pan gesture that auto-selects items in a list, like your favorite gallery app.

- Supports Android & iOS
- Handles scrolling
- Super performant
- Headless API: Bring your own UI
- Works with typical scrollable views - [`ScrollView`](https://reactnative.dev/docs/scrollview), [`FlatList`](https://reactnative.dev/docs/flatlist), [`FlashList`](https://shopify.github.io/flash-list/) etc.

> [!IMPORTANT]
> This package is in public alpha.
>
> <strong>Feedback needed</strong><br/>
> If something is not working as it's supposed to, let me know by submitting an issue. I'm finalizing the initial API and on the lookout for edge cases before releasing v1.0.0

## Table of Contents

- [Usage](#usage)
  - [Quickstart](#quickstart)
  - [Step-by-step](#step-by-step)
- [Installation](#installation)
- [API](#api)
- [Recipes](#recipes)
- [Performance](#performance)
- [Currently Not Supported](#currently-not-supported)
- [Known Issues](#known-issues)
- [Development](#development)

## Usage

### Quickstart

This package is made with [Reanimated](https://docs.swmansion.com/react-native-reanimated) & [Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler), and using it requires some familiarity.

`useDragSelect` is a utility hook. It works by taking in parameters describing the UI of your list and returns managed gestures.

Paste this snippet into your project to get started.

```tsx
import { useDragSelect } from "@osamaq/drag-select"

import { FlatList, View, Text } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedRef, useAnimatedScrollHandler } from "react-native-reanimated"

function List() {
  const data = Array.from({ length: 50 }).map((_, index) => ({
    id: `usr_${index}`,
    name: "foo",
  }))

  const flatlist = useAnimatedRef<FlatList<(typeof data)[number]>>()

  const { gestures, onScroll } = useDragSelect({
    data,
    key: "id",
    list: {
      animatedRef: flatlist,
      numColumns: 2,
      itemSize: { height: 50, width: 50 },
    },
    onItemSelected: (id, index) => {
      console.log("onItemSelected", { id, index })
    },
    onItemDeselected: (id, index) => {
      console.log("onItemDeselected", { id, index })
    },
    onItemPress: (id, index) => {
      console.log("onItemPress", { id, index })
    },
  })

  const scrollHandler = useAnimatedScrollHandler({ onScroll })

  return (
    <GestureDetector gesture={gestures.panHandler}>
      <Animated.FlatList
        data={data}
        ref={flatlist}
        numColumns={2}
        onScroll={scrollHandler}
        renderItem={({ item, index }) => (
          <GestureDetector gesture={gestures.createItemPressHandler(item.id, index)}>
            <View style={{ width: 50, height: 50, backgroundColor: "salmon" }}>
              <Text>{item.id}</Text>
            </View>
          </GestureDetector>
        )}
      />
    </GestureDetector>
  )
}
```

### Step-by-step

#### 1. Create a list

- The list component must be [animated](https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent)
- To use autoscrolling, the component must support [`scrollTo`](https://docs.swmansion.com/react-native-reanimated/docs/scroll/scrollTo/#remarks)

<details>
<summary><strong>Show code</strong></summary>

```tsx
import Animated from "react-native-reanimated"
import { Text, View } from "react-native"

export function List() {
  const data = Array.from({ length: 50 }).map((_, index) => ({
    id: `usr_${index}`,
    name: "foo",
  }))

  return (
    <Animated.ScrollView>
      {data.map((item) => (
        <View key={item.id}>
          <Text>{item.id}</Text>
        </View>
      ))}
    </Animated.ScrollView>
  )
}
```
</details>

#### 2. Style it

When styling your list, parameters like item size and column gap must be specified in plain numbers.

- Avoid relative parameters for item size e.g. `width: "25%"`
- When positioning items, avoid properties like `justifyContent`. Instead, specify column/row gap and padding

That is because we will be passing those parameters to `useDragSelect` and actual item size or location is never measured internally.

<details>
<summary><strong>Show code</strong></summary>

```tsx
const { width: windowWidth } = Dimensions.get("window")

const numColumns = 2
const rowGap = 50
const columnGap = 50

const paddingHorizontal = 24
const listWidth = windowWidth - paddingHorizontal * 2

const itemWidth = (listWidth - columnGap * (numColumns - 1)) / numColumns
const itemHeight = 50
```

The list layout on the other hand is measured once per pan gesture, which is why we have to pass an [animated ref](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedRef/) to the hook.

```tsx
// ...
  const scrollView = useAnimatedRef<Animated.ScrollView>()

  useDragSelect({
    data,
    key: "id",
    list: {
      animatedRef: scrollView,
      columnGap,
      rowGap,
      itemSize: { height: itemHeight, width: itemWidth },
      contentInset: {
        right: paddingHorizontal,
        left: paddingHorizontal,
      },
    },
  })

  return (
    <Animated.ScrollView
      ref={scrollView}
      style={{
        rowGap,
        columnGap,
        paddingHorizontal,
        flexGrow: 1,
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      {data.map((item) => (
        <View
          key={item.id}
          style={{
            width: itemWidth,
            height: itemHeight,
          }}
        >
          <Text>{item.id}</Text>
        </View>
      ))}
    </Animated.ScrollView>
  )
```
</details>

#### 3. Register events

While `useDragSelect` manages gestures for us, we still have to register them. Create [`GestureDetector`](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/gesture-detector/)'s wrapping the list and each item and a [scroll event handler](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/).

- Long pressing an item activates 'selection mode'
- A long press followed by a pan gesture selects items
- In 'selection mode', tapping an item selects it

<details>
<summary><strong>Show code</strong></summary>

```tsx
  const { gestures, onScroll } = useDragSelect(...)

  const scrollHandler = useAnimatedScrollHandler({ onScroll })

  return (
    <GestureDetector gesture={gestures.panHandler}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        ref={...}
        style={...}
      >
        {data.map((item, index) => (
          <GestureDetector
            key={item.id}
            gesture={gestures.createItemPressHandler(item.id, index)}
          >
            <View style={...}>
              <Text>{item.id}</Text>
            </View>
          </GestureDetector>
        ))}
      </Animated.ScrollView>
    </GestureDetector>
  )
```
</details>

#### 4. Build the rest 🦉

The rest is up to you!

> [!TIP]
> - Use methods on the `selection` object to imperatively `add`, `delete` or `clear` items from the JS thread
> - Use `selection.items` to drive animations with Reanimated

Check out [recipes](#recipes) for more fleshed out examples.

## Installation

> [!IMPORTANT]
> This package requires [Reanimated v3](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#installation) and [Gesture Handler v2](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/).

```sh
npm install @osamaq/drag-select
```

```sh
yarn add @osamaq/drag-select
```

```sh
pnpm add @osamaq/drag-select
```

## API

```ts
import { useDragSelect } from "@osamaq/drag-select"
```

### `useDragSelect(config: Config): DragSelect`

<details>
<summary>

### `Config`

</summary>

```ts
interface Config<ListItem = unknown> {
  /**
   * The same array of items rendered on screen in a scrollable view.
   */
  data: Array<ListItem>
  /**
   * Key or path to nested key which uniquely identifies an item in the list.
   * Nested key path is specified using dot notation in a string e.g. `"user.id"`.
   *
   * @example
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
     * const animatedRef = useAnimatedRef()
     * useDragSelect({ list: { animatedRef } })
     * return <Animated.FlatList ref={animatedRef} />
     */
    animatedRef: AnimatedRef<any>
    /**
     * Number of columns in the list.
     * @default 1
     */
    numColumns?: number
    /**
     * Amount of horizontal space between rows.
     * @default 0
     */
    rowGap?: number
    /**
     * Amount of vertical space between columns.
     * @default 0
     */
    columnGap?: number
    /**
     * Height and width of each item in the list.
     */
    itemSize: {
      width: number
      height: number
    }
    /**
     * Inner distance between edges of the list container and list items.
     * Use this to account for list headers/footers and/or padding.
     */
    contentInset?: {
      top?: number
      bottom?: number
      left?: number
      right?: number
    }
  }
  /**
   * Configuration for the long press gesture. Long pressing an item activates selection mode.
   * When selection mode is active, tapping any item will add or remove it from selection.
   */
  longPressGesture?: {
    /**
     * Whether long pressing to activate selection mode is enabled.
     * @default true
     */
    enabled?: boolean
    /**
     * The amount of time in milliseconds an item must be pressed before selection mode activates.
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
     * @default
     *  - 8 on iOS
     *  - 1 on Android
     */
    startMaxVelocity?: number
    /**
     * The maximum scrolling speed when the pointer is at the ending edge of the list window.
     * Must be higher than 0.
     * @default
     *  - 8 on iOS
     *  - 1 on Android
     */
    endMaxVelocity?: number
  }
  /**
   * Invoked on the JS thread whenever an item is tapped, but not added to selection.
   *
   * You may still wrap items with your own pressable while still using this callback to handle presses. This should be more convenient than managing button `disabled` state based on whether selection mode manually.
   */
  onItemPress?: (id: string, index: number) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   */
  onItemSelected?: (id: string, index: number) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   */
  onItemDeselected?: (id: string, index: number) => void
}
```

</details>

<details>
<summary>

### `DragSelect`

</summary>

```ts
interface DragSelect {
  /**
   * Must be used with [`useAnimatedScrollHandler`](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler)
   * and passed to the animated list to use the pan-scroll gesture.
   * Used to obtain scroll offset and list window size.
   *
   * @example
   * const { onScroll } = useDragSelect()
   * const scrollHandler = useAnimatedScrollHandler(onScroll)
   * return <Animated.FlatList onScroll={scrollHandler} />
   */
  onScroll: (event: ReanimatedScrollEvent) => void
  gestures: {
    /**
     * This returns a composed [tap](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture) and
     * [long-press](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/long-press-gesture) gesture.
     * Note that the long press gesture can be disabled by setting `config.longPressGesture.enabled` to `false`. See {@link Config.longPressGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own.
     *
     */
    createItemPressHandler: (id: string, index: number) => SimultaneousGesture
    /**
     * This is a single [pan gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture).
     * If you need to rely solely on pressing items for selection, you can disable the pan gesture by setting `config.panScrollGesture.enabled` to `false`. See {@link Config.panScrollGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own.
     */
    panHandler: PanGesture
  }
  selection: {
    /**
     * Whether the selection mode is active.
     *
     * When active, tapping list items will add them or remove them from selection.
     * Config callbacks {@link Config.onItemSelected} and {@link Config.onItemDeselected} will be invoked instead of {@link Config.onItemPress}.
     */
    active: DerivedValue<boolean>
    /**
     * Add an item to selection. When there are no selected items, adding a single item to selection activates selection mode.
     *
     * Must be invoked on the JS thread.
     * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    add: (id: string) => void
    /**
     * Clear all selected items. Clearing selected items automatically deactivates selection mode.
     * Note that this does not trigger {@link Config.onItemDeselected}.
     *
     * Must be invoked on the JS thread.
     * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    clear: () => void
    /**
     * Remove an item from selection.
     * When the last item is removed from selection, selection mode is deactivated.
     *
     * Must be invoked on the JS thread.
     * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    delete: (id: string) => void
    /**
     * Indicates whether an item is selected.
     *
     * Must be invoked on the JS thread.
     * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    has: (id: string) => boolean
    /**
     * Count of currently selected items.
     */
    size: DerivedValue<number>
    /**
     * A mapping between selected item IDs and their indices.
     */
    items: DerivedValue<Record<string, number>>
    /**
     * Counterpart API for the UI thread.
     */
    ui: {
      /**
       * Add an item to selection. When there are no selected items, adding a single item to selection activates selection mode.
       *
       * Must be invoked on the UI thread.
       * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
       */
      add: (id: string) => void
      /**
       * Clear all selected items. Clearing selected items automatically deactivates selection mode.
       * Note that this does not trigger {@link Config.onItemDeselected}.
       *
       * Must be invoked on the UI thread.
       * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
       */
      clear: () => void
      /**
       * Remove an item from selection.
       * When the last item is removed from selection, selection mode is deactivated.
       *
       * Must be invoked on the UI thread.
       * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
       */
      delete: (id: string) => void
      /**
       * Indicates whether an item is selected.
       *
       * Must be invoked on the UI thread.
       * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
       */
      has: (id: string) => boolean
    }
  }
}
```

</details>

## Recipes

The [recipes app](./example/README.md) contains sample integrations of drag-select.

https://github.com/user-attachments/assets/0e5697d2-aaf8-4888-bfc6-8186f5b0d04b

> Remarks:
> `FlatList`, haptic feedback on selection change.

https://github.com/user-attachments/assets/1087672e-49e8-4463-813a-0d9c7b162921

> Remarks:
> `ScrollView`, items are animated `Pressable` components.

## Performance

Running this utility is not inherently expensive. It works by doing some math on every [frame update](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/) and only when panning the list. In my testing, I could not manage to get any frame drops at this point. However...

Performance cost comes from the additional logic added in response to changes in selection. You can easily cause frame drops by running expensive animations.

> [!TIP]
> Try to be conservative in list item animations on selection change.
>
> - Certain components and properties are more costly to animate than others
> - Don't animate too many things at once

<details>
<summary>Show video: <strong>Animations off</strong></summary>
<video src="https://github.com/user-attachments/assets/03b52a04-63c8-417e-a413-6731efa972b7"/>
</details>

<details>
<summary>Show video: <strong>Animations on</strong></summary>
<video src="https://github.com/user-attachments/assets/c9380c81-1cfb-492e-9d66-a4845828200a"/>
</details>

> Running on iPhone 12 mini in **dev mode**.

## Currently Not Supported

- Horizontal lists
- Inverted lists
- Lists with dynamic item size
- Scroll view [zoom](https://reactnative.dev/docs/scrollview#zoomscale-ios)
- Section lists

## Known Issues

- **Android, new architecture**: In the new architecture, automatic scrolling will lead to the app hanging with an ANR notification. This appears to be a bug with React Native which is [fixed](https://github.com/facebook/react-native/pull/44725) in 0.77+

## Development

This project uses [pnpm](https://pnpm.io/installation).

```sh
pnpm install
pnpm dev start
```

## Acknowledgements

Consider supporting the following projects:

- [Reanimated](https://github.com/software-mansion/react-native-reanimated), [Gesture Handler](https://github.com/software-mansion/react-native-gesture-handler)
  - This package would not be possible otherwise.
- [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
  - The CLI used for bootstrapping this project.
