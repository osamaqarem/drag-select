import { useDragSelect } from "@osamaq/drag-select"
import {
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

const marginHorizontal = 50
const paddingHorizontal = 25
const paddingVertical = 100

const itemWidth = 40
const itemHeight = 60

const gap = 25
const numRows = 3
const listHeight = numRows * (itemHeight + gap) - gap + paddingVertical * 2

export function HorizontalList() {
  const { top: topInset } = useSafeAreaInsets()

  const flatlist = useAnimatedRef<Animated.FlatList<Item>>()

  const { gestures, onScroll, selection } = useDragSelect({
    data,
    key: "id",
    list: {
      columnGap: gap,
      rowGap: gap,
      numRows: numRows,
      animatedRef: flatlist,
      itemSize: { height: itemHeight, width: itemWidth },
      contentInset: {
        top: paddingVertical,
        bottom: paddingVertical,
        left: paddingHorizontal,
        right: paddingHorizontal,
      },
      horizontal: true,
    },
    panGesture: { enabled: false },
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
          horizontal
          data={data}
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
    height: listHeight,
    gap,
    flexWrap: "wrap",
    flexDirection: "column",
  },
  item: {
    height: itemHeight,
    width: itemWidth,
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
