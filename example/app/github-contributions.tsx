import { useDragSelect, type DragSelect } from "@osamaq/drag-select"
import { Dimensions, StyleSheet, View } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
} from "react-native-reanimated"

const windowWidth = Dimensions.get("window").width
const itemSize = 20
const gap = 6

// must be divisible by `itemSize + gap` to avoid extra space
const paddingHorizontal = (itemSize + gap) * 0.5
const paddingVertical = 10

let listWidth = windowWidth * 0.9
// `listWidth` must be divisible `itemSize + gap` so it's a perfect fit.
listWidth = Math.floor(listWidth / (itemSize + gap)) * (itemSize + gap) - gap

const daysInWeek = 7
const listHeight = daysInWeek * (itemSize + gap) - gap + paddingVertical * 2

const numColumns = Math.ceil(
  (listWidth - paddingHorizontal * 2) / (itemSize + gap)
)

export default function GitHubContributions() {
  const numItems = numColumns * daysInWeek
  const data = Array.from({ length: numItems }).map((_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString(),
    count: 5,
  }))

  const ref = useAnimatedRef<View>()

  const { gestures, selection } = useDragSelect({
    data,
    key: "date",
    list: {
      animatedRef: ref,
      itemSize: { width: itemSize, height: itemSize },
      columnGap: gap,
      rowGap: gap,
      numColumns,
      contentInset: {
        right: paddingHorizontal,
        left: paddingHorizontal,
        top: paddingVertical,
        bottom: paddingVertical,
      },
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

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gestures.panHandler}>
        <View style={styles.list} ref={ref}>
          <View style={styles.listContainer}>
            {data.map((item, i) => {
              const isTopLeftCorner = i === 0
              const isBottomLeftCorner = i === 6
              const isTopRightCorner = i === numItems - 7
              const isBottomRightCorner = i === numItems - 1

              const corner = (() => {
                if (isTopLeftCorner) return "top-left"
                if (isBottomLeftCorner) return "bottom-left"
                if (isTopRightCorner) return "top-right"
                if (isBottomRightCorner) return "bottom-right"
                return "none"
              })()

              return (
                <GestureDetector
                  gesture={gestures.createItemPressHandler(item.date, i)}
                  key={item.date}
                >
                  <ListItem
                    id={item.date}
                    selection={selection}
                    corner={corner}
                  />
                </GestureDetector>
              )
            })}
          </View>
        </View>
      </GestureDetector>
    </View>
  )
}

function ListItem({
  id,
  selection,
  corner,
}: {
  id: string
  selection: DragSelect["selection"]
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none"
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const isSelected = selection.ui.has(id)
    return {
      opacity: isSelected ? 0.5 : 1,
    }
  })

  const borderRadiusStyle = {
    borderTopLeftRadius: corner === "top-left" ? 10 : 4,
    borderBottomLeftRadius: corner === "bottom-left" ? 10 : 4,
    borderTopRightRadius: corner === "top-right" ? 10 : 4,
    borderBottomRightRadius: corner === "bottom-right" ? 10 : 4,
  }

  return (
    <Animated.View style={[styles.item, borderRadiusStyle, animatedStyle]} />
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    width: listWidth,
    height: listHeight,
    backgroundColor: "#2c2c2c",
    borderRadius: paddingHorizontal + 10,
    paddingHorizontal,
    paddingVertical,
  },
  listContainer: {
    gap,
    flexWrap: "wrap",
  },
  item: {
    height: itemSize,
    width: itemSize,
    backgroundColor: "green",
    borderRadius: 10,
  },
})
