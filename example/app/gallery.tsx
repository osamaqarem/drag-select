import { useDragSelect } from "@osamaq/drag-select"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import { Image as ExpoImage } from "expo-image"
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

const ROW_GAP = 6
const COL_GAP = 6
const NUM_COL = 4
const ITEM_WIDTH = (windowWidth - COL_GAP * (NUM_COL - 1)) / NUM_COL
const ITEM_HEIGHT = 100

export default function List() {
  const safeArea = useSafeAreaInsets()

  const flatlist = useAnimatedRef<Animated.FlatList<Item>>()

  const bottomPadding = safeArea.bottom + 100
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
        top: safeArea.top,
        bottom: bottomPadding,
      },
    },
    panScrollGesture: {
      enabled: Platform.OS === "ios",
      endThreshold: 0.65,
    },
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

  const panelVisibilityAnimatedStyle = useAnimatedStyle(() => {
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
            paddingTop: safeArea.top,
            paddingBottom: bottomPadding,
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
                gesture={gestures.createItemPressHandler(item.id, index)}
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
            top: safeArea.top + 7,
          },
          styles.clearBtn,
          panelVisibilityAnimatedStyle,
        ]}
        onPress={selection.clear}
      >
        <BlurView
          tint="dark"
          intensity={100}
          experimentalBlurMethod="dimezisBlurView"
          style={styles.clearBtnBlurView}
        >
          <ExpoImage
            source={require("../assets/x-mark.svg")}
            style={styles.clearBtnIcon}
          />
          <AnimatedTextInput
            animatedProps={animatedTextProps}
            defaultValue="0"
            style={styles.clearBtnText}
            editable={false}
          />
        </BlurView>
      </AnimatedPressable>

      <Animated.View
        style={[
          {
            height: bottomPadding,
          },
          styles.bottomPanel,
          panelVisibilityAnimatedStyle,
        ]}
      >
        <BlurView
          tint="dark"
          intensity={100}
          experimentalBlurMethod="dimezisBlurView"
          style={[
            styles.bottomPanelBlurView,
            {
              paddingBottom: safeArea.bottom,
            },
          ]}
        >
          <View style={styles.bottomPanelItem}>
            <ExpoImage
              source={require("../assets/share.svg")}
              style={styles.bottomPanelItemIcon}
            />
            <Text style={styles.bottomPanelText}>Share</Text>
          </View>

          <View style={styles.bottomPanelItem}>
            <ExpoImage
              source={require("../assets/download.svg")}
              style={styles.bottomPanelItemIcon}
            />
            <Text style={styles.bottomPanelText}>Save</Text>
          </View>

          <View style={styles.bottomPanelItem}>
            <ExpoImage
              source={require("../assets/trash.svg")}
              style={styles.bottomPanelItemIcon}
            />
            <Text style={styles.bottomPanelText}>Delete</Text>
          </View>
        </BlurView>
      </Animated.View>
    </>
  )
}

const ItemSeparator = () => <View style={styles.itemSeparator} />

const timing = {
  duration: 300,
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
    const isSelected = selectedItems.value[id] !== undefined
    return {
      padding: withTiming(isSelected ? 4 : 0, timing),
      opacity: isSelected ? 0.6 : 1,
      transform: [
        {
          scale: withTiming(isSelected ? 0.9 : 1, timing),
        },
      ],
    }
  })

  return (
    <Animated.View style={[styles.imageContainer, animatedStyle]}>
      <Animated.Image style={styles.image} source={{ uri: imgUrl }} />
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
  },
  image: {
    height: "100%",
    width: "100%",
    borderRadius: 14,
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
    justifyContent: "flex-start",
    alignItems: "center",
    flexDirection: "row",
  },
  clearBtnIcon: {
    width: 20,
    height: 20,
  },
  clearBtnText: {
    height: "100%",
    minWidth: 45,
    pointerEvents: "none",
    color: "#EDEEF0",
    fontSize: 14,
    paddingLeft: 10,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopRightRadius: 40,
    borderTopLeftRadius: 40,
    overflow: "hidden",
  },
  bottomPanelBlurView: {
    height: "100%",
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "space-around",
    flexDirection: "row",
    alignItems: "center",
  },
  bottomPanelItem: {
    alignItems: "center",
    justifyContent: "center",
    rowGap: 8,
  },
  bottomPanelItemIcon: {
    width: 24,
    height: 24,
  },
  bottomPanelText: {
    color: "#EDEEF0",
    fontSize: 12,
    fontWeight: "500",
  },
})
