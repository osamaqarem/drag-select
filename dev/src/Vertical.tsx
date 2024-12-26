import { useDragSelect } from "@osamaq/drag-select"
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Item = {
  id: string
}

const data: Array<Item> = Array.from({ length: 50 }, (_, i) => ({
  id: (i + 1).toString(),
}))

const ROW_GAP = 20
const COL_GAP = 15
const NUM_COL = 4

const { width: windowWidth } = Dimensions.get("window")
const marginHorizontal = 50
const paddingHorizontal = 25
const paddingVertical = 100
const listWidth = windowWidth - marginHorizontal * 2 - paddingHorizontal * 2

const ITEM_WIDTH = (listWidth - COL_GAP * (NUM_COL - 1)) / NUM_COL
const ITEM_HEIGHT = 80

export function VerticalList() {
  const { top: topInset } = useSafeAreaInsets()

  const flatlist = useAnimatedRef<Animated.FlatList<Item>>()

  const { gestures, onScroll, selection } = useDragSelect({
    data,
    key: "id",
    list: {
      numColumns: NUM_COL,
      columnGap: COL_GAP,
      rowGap: ROW_GAP,
      animatedRef: flatlist,
      itemSize: { height: ITEM_HEIGHT, width: ITEM_WIDTH },
      contentInset: {
        top: paddingVertical,
        bottom: paddingVertical,
        left: paddingHorizontal,
        right: paddingHorizontal,
      },
    },
    panScrollGesture: { enabled: false },
    onItemPress: (id) => {
      console.log("onItemPress", id)
    },
    onItemSelected: (id) => {
      console.log("onItemSelected", id)
    },
    onItemDeselected: (id) => {
      console.log("onItemDeselected", id)
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
        <Animated.FlatList<Item>
          style={styles.flatlist}
          contentContainerStyle={[
            styles.flatlistContent,
            {
              paddingVertical,
              paddingHorizontal,
            },
          ]}
          data={data}
          numColumns={NUM_COL}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item, index }) => (
            <GestureDetector
              gesture={gestures.createItemPressHandler(item.id, index)}
            >
              <View style={styles.item}>
                <Text>{item.id}</Text>
              </View>
            </GestureDetector>
          )}
          keyExtractor={(item) => item.id.toString()}
          ref={flatlist}
          onScroll={scrollHandler}
        />
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

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const styles = StyleSheet.create({
  flatlist: {
    marginVertical: 150,
    marginHorizontal,
    backgroundColor: "blue",
  },
  flatlistContent: {
    backgroundColor: "salmon",
    rowGap: ROW_GAP,
  },
  columnWrapper: {
    columnGap: COL_GAP,
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
