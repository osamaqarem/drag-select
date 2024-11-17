import { useDragSelect } from "@osamaqarem/react-native-drag-select"
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from "react-native"
import {
  GestureDetector,
  GestureHandlerRootView,
  type SimultaneousGesture,
} from "react-native-gesture-handler"
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
} from "react-native-reanimated"
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context"

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.gestureHandlerRootView}>
        <List />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}

type Item = { id: string }

const data: Array<Item> = Array.from({ length: 100 }, (_, i) => ({
  id: (i + 1).toString(),
}))

function List() {
  const { width: deviceWidth } = useWindowDimensions()
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets()

  const flatlist = useAnimatedRef<FlatList<Item>>()

  const {
    panGesture,
    createListItemGesture,
    scrollHandler,
    onListLayout,
    clearSelection,
    selectedItems,
  } = useDragSelect({
    data,
    list: {
      numColumns: 1,
      columnSeparatorWidth: 0,
      rowSeparatorHeight: 0,
      headerHeight: 0,
      ref: flatlist,
      itemSize: { height: 100, width: deviceWidth },
      safeArea: { topInset, bottomInset },
    },
    gestures: {
      longPressMinDurationMs: 300,
    },
    onItemPress: (item) => {
      console.log("onItemPress", item.id)
    },
    onItemSelected: (item) => {
      console.log("onItemSelected", item.id)
    },
    onItemDeselected: (item) => {
      console.log("DESELECT", item.id)
    },
  })

  const animatedProps = useAnimatedProps(() => {
    const count = Object.keys(selectedItems.value).length.toString()
    return {
      text: count,
    } as TextInputProps
  })

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.FlatList<Item>
            style={styles.flatlist}
            data={data}
            numColumns={1}
            renderItem={({ item }) => (
              <Item item={item} createGesture={createListItemGesture} />
            )}
            keyExtractor={(item) => item.id.toString()}
            ref={flatlist}
            onLayout={onListLayout}
            onScroll={scrollHandler}
          />
        </SafeAreaView>
      </GestureDetector>

      <Pressable
        style={[styles.clearBtn, { top: topInset + 14 }]}
        onPress={clearSelection}
      >
        <AnimatedTextInput
          animatedProps={animatedProps}
          defaultValue="0"
          style={styles.clearBtnText}
          editable={false}
        />
      </Pressable>
    </>
  )
}

function Item({
  item,
  createGesture,
}: {
  item: Item
  createGesture: (item: Item) => SimultaneousGesture
}) {
  const gesture = createGesture(item)

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.item}>
        <Text>{item.id}</Text>
      </View>
    </GestureDetector>
  )
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const styles = StyleSheet.create({
  gestureHandlerRootView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "pink",
  },
  flatlist: {
    flex: 1,
    backgroundColor: "white",
  },
  item: {
    height: 100,
    backgroundColor: "lightblue",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "green",
  },
  clearBtn: {
    minWidth: 50,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "lightgreen",
    position: "absolute",
    left: 14,
  },
  clearBtnText: {
    textAlign: "center",
    pointerEvents: "none",
  },
})
