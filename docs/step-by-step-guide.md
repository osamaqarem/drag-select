# Step-by-step Guide

#### 1. Create a list

- The list component must be [animated](https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent)
- To use autoscrolling, the component must support [`scrollTo`](https://docs.swmansion.com/react-native-reanimated/docs/scroll/scrollTo/#remarks)

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

#### 2. Style it

When styling your list, parameters like item size and column gap must be specified in plain numbers.

- Avoid relative parameters for item size e.g. `width: "25%"`
- When positioning items, avoid properties like `justifyContent`. Instead, specify column/row gap and padding

That is because we will be passing those parameters to `useDragSelect` and actual item size or location is never measured internally.

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

#### 3. Register events

While `useDragSelect` manages gestures for us, we still have to register them. Create [`GestureDetector`](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/gesture-detector/)'s wrapping the list and each item and a [scroll event handler](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/).

- Long pressing an item activates 'selection mode'
- A long press followed by a pan gesture selects items
- In 'selection mode', tapping an item selects it

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

#### 4. Build the rest of the UI 🦉

You can now drag-to-select. The rest of the UI is up to you! Check out [recipes](../README.md#recipes) for examples.

> [!TIP]
>
> - Use methods on the `selection` object to imperatively `add`, `delete` or `clear` items etc.
> - Invoke `selection.ui.has` in [`useAnimatedStyle`](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle/) to drive item animations
