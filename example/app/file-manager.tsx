import { faker } from "@faker-js/faker"
import { useDragSelect, type DragSelect } from "@osamaq/drag-select"
import { BlurView } from "expo-blur"
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from "react-native"
import { GestureDetector, Pressable } from "react-native-gesture-handler"
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AnimatedText } from "../components/animated-text"
import { Button } from "../components/button"

const { width: windowWidth } = Dimensions.get("window")

const ROW_GAP = 50
const COL_GAP = 24
const NUM_COL = 3

const paddingHorizontal = 0
const listWidth = windowWidth - paddingHorizontal * 2

const ITEM_WIDTH = (listWidth - COL_GAP * (NUM_COL - 1)) / NUM_COL
const ITEM_HEIGHT = 130

const data = Array.from({ length: 50 }).map((_, index) => {
  const isFolder = Math.random() > 0.5
  return {
    id: `file_${index}`,
    type: isFolder ? "folder" : "file",
    name: isFolder ? faker.system.directoryPath() : faker.system.fileName(),
    updatedAt: faker.date.recent(),
    subDirCount: isFolder ? faker.number.int({ max: 30, min: 1 }) : null,
  } as const
})

export default function FileManager() {
  const safeArea = useSafeAreaInsets()

  const scrollView = useAnimatedRef<Animated.ScrollView>()

  const headerHeight = 50
  const paddingTop = headerHeight + 10
  const { gestures, onScroll, selection } = useDragSelect({
    data,
    key: "id",
    list: {
      numColumns: NUM_COL,
      columnGap: COL_GAP,
      rowGap: ROW_GAP,
      animatedRef: scrollView,
      itemSize: { height: ITEM_HEIGHT, width: ITEM_WIDTH },
      contentInset: {
        top: paddingTop,
        bottom: safeArea.bottom,
        right: paddingHorizontal,
        left: paddingHorizontal,
      },
    },
    onItemSelected: (id, index) => {
      console.log("onItemSelected", { id, index })
    },
    onItemDeselected: (id, index) => {
      console.log("onItemDeselected", { id, index })
    },
    onItemPress: (_id, index) => {
      Alert.alert("Press!", `You clicked ${data[index]?.name}`)
    },
  })

  const scrollHandler = useAnimatedScrollHandler({ onScroll })

  const textAnimatedProps = useAnimatedProps(() => {
    const count = selection.size.value
    const text = `${count} Items`
    return {
      text: selection.active.value ? text : "",
    } as TextInputProps
  })

  const headerVisibilityAnimatedStyle = useAnimatedStyle(() => {
    return {
      pointerEvents: selection.active.value ? "auto" : "none",
      opacity: selection.active.value ? 1 : 0,
    }
  })

  return (
    <>
      <GestureDetector gesture={gestures.panHandler}>
        <Animated.ScrollView
          ref={scrollView}
          onScroll={scrollHandler}
          contentContainerStyle={[
            styles.scrollViewContent,
            {
              paddingTop,
              paddingBottom: safeArea.bottom,
            },
          ]}
        >
          {data.map((item, index) => {
            return (
              <GestureDetector
                key={item.id}
                gesture={gestures.createItemPressHandler(item.id, index)}
              >
                <ListItem {...item} selection={selection} />
              </GestureDetector>
            )
          })}
        </Animated.ScrollView>
      </GestureDetector>

      <Animated.View
        style={[
          { height: headerHeight },
          headerVisibilityAnimatedStyle,
          styles.header,
        ]}
      >
        <BlurView
          tint="dark"
          intensity={100}
          experimentalBlurMethod="dimezisBlurView"
          style={styles.blurView}
        >
          <View style={styles.flex} />
          <AnimatedText
            animatedProps={textAnimatedProps}
            style={styles.clearBtnText}
          />
          <Pressable onPress={selection.clear} style={styles.clearBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </BlurView>
      </Animated.View>
    </>
  )
}

function ListItem({
  selection,
  type,
  name,
  id,
  updatedAt,
  subDirCount,
}: {
  selection: DragSelect["selection"]
  type: "file" | "folder"
  name: string
  id: string
  updatedAt: Date
  subDirCount: number | null
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const isSelected = selection.ui.has(id)
    return {
      backgroundColor: isSelected ? "#484848" : "transparent",
    }
  })

  const img =
    type === "file"
      ? require("../assets/document.png")
      : require("../assets/folder.png")

  return (
    <Button style={styles.item}>
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <Image
          source={img}
          resizeMode="contain"
          style={[{ height: ITEM_HEIGHT - 40 }, styles.image]}
        />
        <Text style={styles.itemTitle} numberOfLines={2}>
          {name}
        </Text>
      </Animated.View>
      <Text style={styles.itemSubtitle} numberOfLines={2}>
        {type === "file" ? updatedAt.toDateString() : `${subDirCount} items`}
      </Text>
    </Button>
  )
}

const styles = StyleSheet.create({
  scrollViewContent: {
    paddingHorizontal,
    rowGap: ROW_GAP,
    columnGap: COL_GAP,
    flexGrow: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  item: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
  },
  header: {
    position: "absolute",
    top: 0,
    width: "100%",
  },
  clearBtnText: {
    flex: 1,
    textAlign: "center",
    color: "#EDEEF0",
    fontSize: 14,
    fontWeight: "bold",
  },
  doneBtnText: {
    color: "#0B85FF",
    fontSize: 14,
    fontWeight: "500",
  },
  flex: {
    flex: 1,
  },
  image: {
    width: "100%",
  },
  itemTitle: {
    textAlign: "center",
    fontSize: 12,
    color: "white",
  },
  imageContainer: {
    borderRadius: 4,
    paddingBottom: 4,
  },
  itemSubtitle: {
    marginTop: 2,
    textAlign: "center",
    alignSelf: "center",
    fontSize: 10,
    color: "gray",
    width: "80%",
  },
  blurView: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    flexDirection: "row",
    flex: 1,
    paddingHorizontal: 10,
  },
  clearBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
})
