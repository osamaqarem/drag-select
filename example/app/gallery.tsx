import { useDragSelect } from "@osamaqarem/drag-select"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface Item {
  id: string
  imageUrl: string
}

const data: Array<Item> = Array.from({ length: 100 }, (_, i) => ({
  id: `img_${i}`,
  imageUrl: `https://picsum.photos/seed/420${i}/900/600`,
}))

const { width: windowWidth } = Dimensions.get("window")

const ROW_GAP = 2
const COL_GAP = 2
const NUM_COL = 5
const ITEM_WIDTH = (windowWidth - COL_GAP * (NUM_COL - 1)) / NUM_COL
const ITEM_HEIGHT = 80

export default function List() {
  const { bottom: bottomInset } = useSafeAreaInsets()
  const topInset = 10

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
        top: topInset,
        bottom: bottomInset,
      },
    },
    panScrollGesture: { enabled: Platform.OS === "ios" },
    onItemPress: (id, index) => {
      console.log("onItemPress", { id, index })
    },
    onItemSelected: (id, index) => {
      console.log("onItemSelected", { id, index })
    },
    onItemDeselected: (id, index) => {
      console.log("onItemDeselected", { id, index })
    },
  })

  const scrollHandler = useAnimatedScrollHandler(onScroll)

  const animatedClearBtnStyle = useAnimatedStyle(() => {
    return {
      pointerEvents: selection.size.value > 0 ? "auto" : "none",
      opacity: selection.size.value > 0 ? 1 : 0,
    }
  })

  const animatedTextProps = useAnimatedProps(() => {
    return {
      text: selection.size.value.toString(),
    } as TextInputProps
  })

  // Haptic feedback when selection changes.
  useAnimatedReaction(
    () => selection.size.value,
    (next, prev) => {
      const prevVal = prev ?? 0
      if (next !== prevVal) {
        runOnJS(Haptics.selectionAsync)()
      }
    }
  )

  return (
    <>
      <GestureDetector gesture={gestures.panHandler}>
        <Animated.FlatList<Item>
          style={styles.flatlist}
          contentContainerStyle={{
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
          ItemSeparatorComponent={ItemSeparator}
          columnWrapperStyle={styles.columnWrapper}
          getItemLayout={(_data, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          data={data}
          numColumns={NUM_COL}
          renderItem={({ item, index }) => {
            return (
              <GestureDetector
                gesture={gestures.createItemPressHandler(item, index)}
              >
                <ListItem
                  id={item.id}
                  imgUrl={item.imageUrl}
                  selectedItems={selection.items}
                />
              </GestureDetector>
            )
          }}
          keyExtractor={(item) => item.id.toString()}
          ref={flatlist}
          onScroll={scrollHandler}
        />
      </GestureDetector>

      <AnimatedPressable
        style={[
          {
            top: topInset + 7,
          },
          styles.clearBtn,
          animatedClearBtnStyle,
        ]}
        onPress={selection.clear}
      >
        <BlurView
          tint="dark"
          intensity={100}
          experimentalBlurMethod="dimezisBlurView"
          style={styles.clearBtnBlurView}
        >
          <AnimatedTextInput
            animatedProps={animatedTextProps}
            defaultValue="0"
            style={styles.clearBtnText}
            editable={false}
          />
        </BlurView>
      </AnimatedPressable>
    </>
  )
}

const ItemSeparator = () => <View style={styles.itemSeparator} />

const timing = {
  duration: 100,
  easing: Easing.bezier(0.33, 1, 0.68, 1),
}

const ListItem = ({
  id,
  imgUrl,
  selectedItems,
}: {
  id: string
  imgUrl: string
  selectedItems: SharedValue<Record<string, number>>
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isSelected = typeof selectedItems.value[id] === "number"
    return {
      padding: withTiming(isSelected ? 5 : 0, timing),
      transform: [
        {
          scale: withTiming(isSelected ? 0.95 : 1, timing),
        },
      ],
      // We don't want to use `withTiming` here, but this fixes an issue where the border color does not update on Android when clearing all selected items.
      borderColor: withTiming(isSelected ? "#5eb1ef" : "transparent", {
        duration: 1,
      }),
    }
  })

  return (
    <Animated.View style={[styles.imageContainer, animatedStyle]}>
      <Image style={styles.image} source={{ uri: imgUrl }} contentFit="cover" />
    </Animated.View>
  )
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const styles = StyleSheet.create({
  flatlist: {
    backgroundColor: "black",
  },
  columnWrapper: {
    columnGap: COL_GAP,
  },
  imageContainer: {
    height: ITEM_HEIGHT,
    width: ITEM_WIDTH,
    borderWidth: 2,
    borderRadius: 15,
    borderStyle: "dotted",
  },
  image: {
    height: "100%",
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#222",
  },
  itemSeparator: {
    height: ROW_GAP,
  },
  clearBtn: {
    position: "absolute",
    left: 14,
  },
  clearBtnBlurView: {
    minWidth: 80,
    minHeight: 45,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 50,
    overflow: "hidden",
    justifyContent: "center",
  },
  clearBtnText: {
    pointerEvents: "none",
    textAlign: "center",
    color: "white",
    fontSize: 14,
  },
})
