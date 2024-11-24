import { useDragSelect } from "@osamaqarem/react-native-drag-select"
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  useAnimatedScrollHandler,
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

type Item = {
  id: string
}

const data: Array<Item> = Array.from({ length: 100 }, (_, i) => ({
  id: (i + 1).toString(),
}))

const ROW_GAP = 30
const COL_GAP = 30
const NUM_COL = 3

const ITEM_WIDTH = (Dimensions.get("window").width - 60) / NUM_COL // 60 is 30 (COL_GAP) * 2 (NUM_COLUMNS - 1)
const ITEM_HEIGHT = 100

function List() {
  const { top: topInset } = useSafeAreaInsets()

  const flatlist = useAnimatedRef<Animated.FlatList<Item>>()

  const { gestures, onScroll, selection } = useDragSelect({
    data,
    key: "id",
    list: {
      numColumns: NUM_COL,
      columnSeparatorWidth: COL_GAP,
      rowSeparatorHeight: ROW_GAP,
      animatedRef: flatlist,
      itemSize: { height: ITEM_HEIGHT, width: ITEM_WIDTH },
    },
    onItemPress: (item) => {
      console.log("onItemPress", item.id)
    },
    onItemSelected: (item) => {
      console.log("onItemSelected", item.id)
    },
    onItemDeselected: (item) => {
      console.log("onItemDeselected", item.id)
    },
  })

  const scrollHandler = useAnimatedScrollHandler(onScroll)

  const animatedProps = useAnimatedProps(() => {
    return {
      text: selection.size.value.toString(),
    } as TextInputProps
  })

  return (
    <>
      <GestureDetector gesture={gestures.panHandler}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.FlatList<Item>
            style={styles.flatlist}
            ItemSeparatorComponent={ItemSeparator}
            columnWrapperStyle={styles.columnWrapper}
            data={data}
            numColumns={NUM_COL}
            renderItem={({ item }) => (
              <Item
                item={item}
                createGesture={gestures.createItemPressHandler}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            ref={flatlist}
            onScroll={scrollHandler}
          />
        </SafeAreaView>
      </GestureDetector>

      <Pressable
        style={[styles.clearBtn, { top: topInset + 14 }]}
        onPress={selection.clear}
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

const ItemSeparator = () => <View style={styles.itemSeparator} />

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
    justifyContent: "center",
  },
  flatlist: {
    backgroundColor: "salmon",
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  item: {
    height: ITEM_HEIGHT,
    width: ITEM_WIDTH,
    backgroundColor: "lightblue",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "green",
  },
  itemSeparator: {
    height: ROW_GAP,
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
