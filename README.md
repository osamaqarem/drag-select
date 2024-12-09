# 👆 Drag Select for React Native

<pre></pre>

A utility for creating a pan gesture that auto-selects items in a list, like your favorite gallery app.

- Supports Android & iOS
- Handles scrolling
- Super performant
- Headless API: Bring your own UI
- Works with typical scrollable views - [`ScrollView`](https://reactnative.dev/docs/scrollview), [`FlatList`](https://reactnative.dev/docs/flatlist), [`FlashList`](https://shopify.github.io/flash-list/) etc.

> [!IMPORTANT]
> This package is in public alpha. Breaking changes may occur in any release until v1.0.0
>
> <strong>Feedback wanted!</strong><br/>
> If your use case is [not supported](#currently-not-supported) or something is not working as expected, I'd want to hear from you.<br/>Please check the issues tab for similar feedback or submit a new issue.

## Table of Contents

- [Usage](#usage)
- [Installation](#installation)
- [API](#api)
- [Recipes](#recipes)
- [Currently Not Supported](#currently-not-supported)
- [Development](#development)

## Usage

This package is made with [Reanimated](https://docs.swmansion.com/react-native-reanimated) & [Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler), and using it requires some familiarity.

`useDragSelect` is a utility hook. It works by taking in parameters describing the UI of your list and returns managed gestures.

It's important to specify list config parameters correctly as actual item size and location is never measured.

```tsx
import { useDragSelect } from "@osamaqarem/drag-select"

import { View, Text } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedRef, useAnimatedScrollHandler } from "react-native-reanimated"

function List() {
  const data = [{ id: "usr_123", name: "foo" }]

  const flatlist = useAnimatedRef()

  const { gestures, onScroll } = useDragSelect({
    data,
    key: "id",
    list: {
      columnSeparatorWidth: 0,
      rowSeparatorHeight: 30,
      animatedRef: flatlist,
      itemSize: { height: 50, width: 50 },
    },
  })

  const scrollHandler = useAnimatedScrollHandler({ onScroll })

  return (
    <GestureDetector gesture={gestures.panHandler}>
      <Animated.FlatList
        data={data}
        ItemSeparatorComponent={<View style={{ height: 30 }} />}
        onScroll={scrollHandler}
        renderItem={({ item, index }) => (
          <GestureDetector gesture={gestures.createItemPressHandler(item, index)}>
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

> [!IMPORTANT]
> This package requires [Reanimated v3](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#installation) and [Gesture Handler v2](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/).

```sh
npm install @osamaqarem/drag-select
```

```sh
yarn add @osamaqarem/drag-select
```

```sh
pnpm add @osamaqarem/drag-select
```

## API

```ts
import { useDragSelect } from "@osamaqarem/drag-select"
```

### `useDragSelect(config: Config): DragSelect`

<details>
<summary>

### `Config`

</summary>

```ts
interface Config<ListItem> {
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
     */
    rowGap: number
    /**
     * Amount of vertical space between columns.
     */
    columnGap: number
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
   * Use this callback to handle press events instead of wrapping items in a pressable component.
   */
  onItemPress?: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is added to selection.
   */
  onItemSelected?: (item: ListItem) => void
  /**
   * Invoked on the JS thread whenever an item is removed from selection.
   */
  onItemDeselected?: (item: ListItem) => void
}
```

</details>

<details>
<summary>

### `DragSelect`

</summary>

```ts
interface DragSelect<ListItem> {
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
     * This is a composed [tap](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/tap-gesture) and
     * [long-press](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/long-press-gesture) gesture.
     * Note that the long press gesture can be disabled by setting `config.longPressGesture.enabled` to `false`. See {@link Config.longPressGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own custom gestures.
     *
     */
    createItemPressHandler: (
      item: ListItem,
      index: number
    ) => SimultaneousGesture
    /**
     * This is a single [pan gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture).
     * If you need to rely solely on pressing items for selection, you can disable the pan gesture by setting `config.panScrollGesture.enabled` to `false`. See {@link Config.panScrollGesture}.
     *
     * Do not customize the behavior of this gesture directly.
     * Instead, [compose](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/composed-gestures) it with your own custom gestures.
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
    active: ReadonlySharedValue<boolean>
    /**
     * Add an item to selection. When there are no selected items, adding a single item to selection activates selection mode.
     *
     * Must be invoked on the JS thread.
     * Note that updates are reflected asynchronously on the JS thread and synchronously on the UI thread.
     */
    add: (id: string) => void
    /**
     * Clear all selected items. Clearing selected items automatically deactivates selection mode.
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
    size: ReadonlySharedValue<number>
  }
}
```

</details>

## Recipes

TODO

## Performance

Running this utility is not inherently expensive. It works by doing some math on every [frame update](https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/) and only when panning the list. Performance cost comes from the additional logic added in response to changes in selection. If you're finding that this is not the case, please submit an issue with details/reproduction and I'm happy to take a look.

> [!TIP]
> Try to be conservative in list item animations on selection change.

### +60Hz Displays

Only tested on a 60Hz display.

Drag-to-select calcuations happen once per frame. The more frames are rendered each second, the more often that calculation occurs. If the perceived responsiveness when executing this utility 60 times/sec on a 120Hz display the same as executing it 120 times/sec, then this could be something to optimize.

## Currently Not Supported

- Horizontal lists
- Inverted lists
- Lists with dynamic item size
- Section lists

Most would be easy to support, except lists with dynamic item size. I'm not sure drag-to-select would make sense there anyway.


## Development

This project uses [pnpm](https://pnpm.io/installation).

```sh
pnpm install
pnpm dev ios
```

## Acknowledgements

Consider supporting the following projects:

- [Reanimated](https://github.com/software-mansion/react-native-reanimated), [Gesture Handler](https://github.com/software-mansion/react-native-gesture-handler)
  - This package would not be possible otherwise.
- [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
  - The CLI used for bootstrapping this project.